import { DurableObject } from "cloudflare:workers";

import {
  ClientMessage,
  buildErrorMessage,
  buildJoinedMessage,
  buildPlayerJoinedMessage,
  buildPlayerLeftMessage,
  buildPongMessage,
  buildStateMessage,
} from "./messages";
import { disambiguateName } from "./player";
import type { Player } from "./player";
import { CLEANUP_ALARM_DELAY_MS, InitRoomRequest, ROOM_STORAGE_KEY } from "./room-record";
import type { RoomRecord } from "./room-record";

interface WebSocketAttachment {
  playerId: string;
}

export class RoomDO extends DurableObject {
  // Number of times this class has been constructed for a given DO instance —
  // increments on cold start and on every hibernation wake. Restored from
  // storage in blockConcurrencyWhile so it survives eviction, proving state
  // recovery works even though this DO carries no room state yet.
  private wakeCount = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      const stored = (await ctx.storage.get<number>("wakeCount")) ?? 0;
      this.wakeCount = stored + 1;
      await ctx.storage.put("wakeCount", this.wakeCount);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/init") {
      return this.handleInit(request);
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      // Plain HTTP ping, used by the /debug bindings check.
      return new Response("pong");
    }

    const room = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
    if (!room) {
      return Response.json(
        { error: "room_not_found", message: "No room exists for this code." },
        { status: 404 },
      );
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleInit(request: Request): Promise<Response> {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    const parsed = InitRoomRequest.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    const existing = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
    if (existing) {
      return Response.json({ error: "room_exists" }, { status: 409 });
    }

    const room: RoomRecord = {
      code: parsed.data.code,
      createdAt: Date.now(),
      hostId: null,
      players: {},
    };
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);
    await this.ctx.storage.setAlarm(Date.now() + CLEANUP_ALARM_DELAY_MS);

    return Response.json(room, { status: 201 });
  }

  async alarm(): Promise<void> {
    // Cleanup policy TBD — see docs/SPEC.md §9. Registering the alarm now
    // proves rooms don't live forever unmanaged; the actual GC decision
    // (expire idle rooms? archive scores?) is deferred to #22.
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      return;
    }

    const result = ClientMessage.safeParse(raw);
    if (!result.success) return;

    switch (result.data.type) {
      case "ping":
        this.handlePing();
        return;
      case "join":
        await this.handleJoin(ws, result.data.name);
        return;
      case "rejoin":
        await this.handleRejoin(ws, result.data.playerId);
        return;
    }
  }

  private handlePing(): void {
    const pong = buildPongMessage(this.wakeCount);
    this.broadcast(pong);
  }

  private async handleJoin(ws: WebSocket, name: string): Promise<void> {
    const existingAttachment: WebSocketAttachment | null = ws.deserializeAttachment();
    if (existingAttachment) {
      ws.send(buildErrorMessage("already_joined", "This connection already has a player."));
      return;
    }

    const room = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
    if (!room) {
      ws.send(buildErrorMessage("room_not_found", "No room exists for this code."));
      return;
    }

    const existingNames = Object.values(room.players).map((player) => player.name);
    const player: Player = {
      id: crypto.randomUUID(),
      name: disambiguateName(name, existingNames),
      connected: true,
      honey: 0,
      stung: false,
      joinedAtRound: 0,
    };

    room.players[player.id] = player;
    if (!room.hostId) room.hostId = player.id;
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);

    const attachment: WebSocketAttachment = { playerId: player.id };
    ws.serializeAttachment(attachment);

    ws.send(buildJoinedMessage(player));
    this.broadcast(buildPlayerJoinedMessage(player), ws);
    this.broadcast(buildStateMessage(room));
  }

  private async handleRejoin(ws: WebSocket, playerId: string): Promise<void> {
    const room = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
    const player = room?.players[playerId];
    if (!room || !player) {
      ws.send(buildErrorMessage("unknown_player", "No player found for this id — join again."));
      return;
    }

    player.connected = true;
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);

    const attachment: WebSocketAttachment = { playerId: player.id };
    ws.serializeAttachment(attachment);

    ws.send(buildJoinedMessage(player));
    this.broadcast(buildPlayerJoinedMessage(player), ws);
    this.broadcast(buildStateMessage(room));
  }

  private broadcast(message: string, exclude?: WebSocket): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exclude) continue;
      socket.send(message);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const attachment: WebSocketAttachment | null = ws.deserializeAttachment();
    if (attachment) {
      const room = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
      const player = room?.players[attachment.playerId];
      if (room && player) {
        player.connected = false;
        await this.ctx.storage.put(ROOM_STORAGE_KEY, room);
        this.broadcast(buildPlayerLeftMessage(player));
        this.broadcast(buildStateMessage(room));
      }
    }

    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("RoomDO websocket error", error);
    ws.close(1011, "error");
  }
}
