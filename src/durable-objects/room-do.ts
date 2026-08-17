import { DurableObject } from "cloudflare:workers";

import { computeAnswerProgress } from "./answer";
import type { Answer } from "./answer";
import {
  ANSWERING_PHASE_DURATION_MS,
  earliestAlarmAt,
  hasAnsweringTimedOut,
} from "./answering-timer";
import { clusterAnswers } from "./cluster";
import { HOST_PROMOTION_DELAY_MS, pickPromotedHost } from "./host";
import {
  ClientMessage,
  buildAnswerProgressMessage,
  buildErrorMessage,
  buildJoinedMessage,
  buildPhaseMessage,
  buildPlayerJoinedMessage,
  buildPlayerLeftMessage,
  buildPongMessage,
  buildQuestionMessage,
  buildRevealMessage,
  buildScoresMessage,
  buildStateMessage,
} from "./messages";
import { checkNextRound } from "./next-round";
import { disambiguateName } from "./player";
import type { Player } from "./player";
import { pickQuestion } from "./question";
import type { Question } from "./question";
import {
  CLEANUP_ALARM_DELAY_MS,
  EMPTY_ROOM_CLEANUP_DELAY_MS,
  InitRoomRequest,
  ROOM_STORAGE_KEY,
} from "./room-record";
import type { RoomRecord } from "./room-record";
import { sanitiseFor } from "./sanitise";
import { applyStingAndOffload, awardHoney, checkWinners } from "./score";
import { checkStart } from "./start";
import { checkSubmitAnswer } from "./submit-answer";

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
      phase: "lobby",
      round: 0,
      currentQuestion: null,
      usedQuestionIds: [],
      answers: {},
      clusters: null,
      answeringDeadlineAt: null,
    };
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);
    await this.scheduleAlarmNoLaterThan(Date.now() + CLEANUP_ALARM_DELAY_MS);

    return Response.json(room, { status: 201 });
  }

  async alarm(): Promise<void> {
    const room = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
    if (!room) return;

    if (hasAnsweringTimedOut(room.phase, room.answeringDeadlineAt, Date.now())) {
      await this.advanceToReveal(room);
    }

    const host = room.hostId ? room.players[room.hostId] : undefined;
    if (host && !host.connected) {
      const promoted = pickPromotedHost(room.players);
      if (promoted) {
        room.hostId = promoted;
        await this.ctx.storage.put(ROOM_STORAGE_KEY, room);
        this.broadcastState(room);
      }
    }

    const stillConnected = Object.values(room.players).some((player) => player.connected);
    if (stillConnected) {
      // Cleanup policy TBD — see docs/SPEC.md §9. Re-arming now proves rooms
      // don't live forever unmanaged; the actual GC decision (expire idle
      // rooms? archive scores?) is deferred to #22.
      await this.scheduleAlarmNoLaterThan(Date.now() + CLEANUP_ALARM_DELAY_MS);
    }
  }

  // A DO has one alarm slot shared by the answering timer, host-promotion
  // recheck, and room cleanup — only ever move it earlier, never later, so
  // one concern's schedule call can't clobber another's sooner deadline.
  private async scheduleAlarmNoLaterThan(at: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    await this.ctx.storage.setAlarm(earliestAlarmAt(current, at));
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
      case "start":
        await this.handleStart(ws);
        return;
      case "submitAnswer":
        await this.handleSubmitAnswer(ws, result.data.text);
        return;
      case "nextRound":
        await this.handleNextRound(ws);
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
      connectedSince: Date.now(),
    };

    room.players[player.id] = player;
    if (!room.hostId) room.hostId = player.id;
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);

    const attachment: WebSocketAttachment = { playerId: player.id };
    ws.serializeAttachment(attachment);

    ws.send(buildJoinedMessage(player));
    this.broadcast(buildPlayerJoinedMessage(player), ws);
    this.broadcastState(room);
  }

  private async handleRejoin(ws: WebSocket, playerId: string): Promise<void> {
    const room = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
    const player = room?.players[playerId];
    if (!room || !player) {
      ws.send(buildErrorMessage("unknown_player", "No player found for this id — join again."));
      return;
    }

    player.connected = true;
    player.connectedSince = Date.now();
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);

    const attachment: WebSocketAttachment = { playerId: player.id };
    ws.serializeAttachment(attachment);

    ws.send(buildJoinedMessage(player));
    this.broadcast(buildPlayerJoinedMessage(player), ws);
    if (room.phase === "answering") this.broadcastAnswerProgress(room);
    this.broadcastState(room);
  }

  private async handleStart(ws: WebSocket): Promise<void> {
    const attachment: WebSocketAttachment | null = ws.deserializeAttachment();
    if (!attachment) {
      ws.send(buildErrorMessage("not_joined", "Join the room before starting the game."));
      return;
    }

    const room = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
    if (!room) {
      ws.send(buildErrorMessage("room_not_found", "No room exists for this code."));
      return;
    }

    const rejection = checkStart(room.phase, room.hostId, attachment.playerId, room.players);
    if (rejection) {
      ws.send(buildErrorMessage(rejection.code, rejection.message));
      return;
    }

    room.round = 1;
    await this.beginRound(room);
  }

  private async handleNextRound(ws: WebSocket): Promise<void> {
    const attachment: WebSocketAttachment | null = ws.deserializeAttachment();
    if (!attachment) {
      ws.send(buildErrorMessage("not_joined", "Join the room before starting the next round."));
      return;
    }

    const room = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
    if (!room) {
      ws.send(buildErrorMessage("room_not_found", "No room exists for this code."));
      return;
    }

    const rejection = checkNextRound(room.phase, room.hostId, attachment.playerId);
    if (rejection) {
      ws.send(buildErrorMessage(rejection.code, rejection.message));
      return;
    }

    room.round += 1;
    room.answers = {};
    room.clusters = null;
    await this.beginRound(room);
  }

  // Shared by `start` (round 1) and `nextRound` (round N+1): pick a
  // question, broadcast it, then move straight into `answering`. No
  // read-time delay yet — the answering-phase timer is #18.
  private async beginRound(room: RoomRecord): Promise<void> {
    room.phase = "question";

    const question = await this.selectQuestion(room.usedQuestionIds);
    if (question) {
      room.currentQuestion = question;
      room.usedQuestionIds.push(question.id);
    }

    this.broadcast(buildPhaseMessage(room.phase));
    if (question) {
      this.broadcast(buildQuestionMessage(question.text, question.category));
    }

    room.phase = "answering";
    room.answeringDeadlineAt = Date.now() + ANSWERING_PHASE_DURATION_MS;
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);
    await this.scheduleAlarmNoLaterThan(room.answeringDeadlineAt);

    this.broadcast(buildPhaseMessage(room.phase, room.answeringDeadlineAt));
    this.broadcastAnswerProgress(room);
    this.broadcastState(room);
  }

  private async handleSubmitAnswer(ws: WebSocket, text: string): Promise<void> {
    const attachment: WebSocketAttachment | null = ws.deserializeAttachment();
    if (!attachment) {
      ws.send(buildErrorMessage("not_joined", "Join the room before answering."));
      return;
    }

    const room = await this.ctx.storage.get<RoomRecord>(ROOM_STORAGE_KEY);
    if (!room) {
      ws.send(buildErrorMessage("room_not_found", "No room exists for this code."));
      return;
    }

    const rejection = checkSubmitAnswer(room.phase, attachment.playerId, room.players);
    if (rejection) {
      ws.send(buildErrorMessage(rejection.code, rejection.message));
      return;
    }

    const answer: Answer = { playerId: attachment.playerId, text, submittedAt: Date.now() };
    room.answers[attachment.playerId] = answer;
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);

    this.broadcastAnswerProgress(room);

    const progress = computeAnswerProgress(room.players, room.answers);
    if (progress.answered === progress.total && progress.total > 0) {
      await this.advanceToReveal(room);
      return;
    }

    this.broadcastState(room);
  }

  // Every connected player has answered — advance answering -> judging ->
  // reveal in one step. v0 clustering (#15) is synchronous, so judging has
  // no real work to do yet; the intermediate phase broadcast still fires so
  // clients' phase handling is exercised the same way it will be once #20
  // makes judging an actual async LLM call.
  private async advanceToReveal(room: RoomRecord): Promise<void> {
    room.phase = "judging";
    room.answeringDeadlineAt = null;
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);
    this.broadcast(buildPhaseMessage(room.phase));

    const clusters = clusterAnswers(room.answers);
    room.clusters = clusters;
    room.phase = "reveal";
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);

    this.broadcast(buildPhaseMessage(room.phase));
    const answersByPlayer: Record<string, string> = {};
    for (const answer of Object.values(room.answers)) {
      answersByPlayer[answer.playerId] = answer.text;
    }
    this.broadcast(buildRevealMessage(clusters, answersByPlayer));
    this.broadcastState(room);

    await this.advanceToScoring(room);
  }

  // Honey/sting are awarded the moment scoring starts — "scoring" is a
  // computed step, not a host-gated one (docs/SPEC.md §3 Phase comment:
  // "honey awarded, sting assigned"). If awarding honey/offloading a sting
  // produces a winner, continue straight on to `gameover` in the same turn.
  private async advanceToScoring(room: RoomRecord): Promise<void> {
    const clusters = room.clusters ?? [];
    for (const playerId of awardHoney(clusters)) {
      const player = room.players[playerId];
      if (player) player.honey += 1;
    }
    room.players = applyStingAndOffload(clusters, room.players);

    room.phase = "scoring";
    await this.ctx.storage.put(ROOM_STORAGE_KEY, room);

    this.broadcast(buildPhaseMessage(room.phase));
    const players = Object.values(room.players);
    const stungPlayerIds = players.filter((player) => player.stung).map((player) => player.id);
    this.broadcast(buildScoresMessage(players, stungPlayerIds));
    this.broadcastState(room);

    if (checkWinners(room.players).length > 0) {
      room.phase = "gameover";
      await this.ctx.storage.put(ROOM_STORAGE_KEY, room);
      this.broadcast(buildPhaseMessage(room.phase));
      this.broadcastState(room);
    }
  }

  // Broadcasts the same { answered, total } tuple to everyone — unlike state,
  // this carries no answer text, so it's safe to send identically to all
  // sockets rather than routing through sanitiseFor().
  private broadcastAnswerProgress(room: RoomRecord): void {
    const { answered, total } = computeAnswerProgress(room.players, room.answers);
    this.broadcast(buildAnswerProgressMessage(answered, total));
  }

  // Queries D1 for the approved question pool and picks one avoiding
  // usedQuestionIds. Only ~20 rows for now (#11) — cheap to fetch in full
  // each round rather than pushing exclusion logic into SQL.
  private async selectQuestion(usedQuestionIds: readonly string[]): Promise<Question | null> {
    const { results } = await this.env.DB.prepare(
      "SELECT id, text, category FROM questions WHERE approved = 1",
    ).all<Question>();

    return pickQuestion(results, usedQuestionIds);
  }

  private broadcast(message: string, exclude?: WebSocket): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exclude) continue;
      socket.send(message);
    }
  }

  // Sends each socket its own sanitised view of `room` — never the same
  // `state` payload to everyone, since answers must stay hidden pre-reveal
  // (docs/SPEC.md §4).
  private broadcastState(room: RoomRecord): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment: WebSocketAttachment | null = socket.deserializeAttachment();
      if (!attachment) continue;
      socket.send(buildStateMessage(sanitiseFor(attachment.playerId, room)));
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
        if (room.phase === "answering") this.broadcastAnswerProgress(room);
        this.broadcastState(room);

        const stillConnected = Object.values(room.players).some((p) => p.connected);
        if (!stillConnected) {
          // Last player gone — schedule the room for cleanup sooner than the
          // default horizon. Actual deletion policy is still #22's job.
          await this.scheduleAlarmNoLaterThan(Date.now() + EMPTY_ROOM_CLEANUP_DELAY_MS);
        } else if (player.id === room.hostId) {
          await this.scheduleAlarmNoLaterThan(Date.now() + HOST_PROMOTION_DELAY_MS);
        }
      }
    }

    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("RoomDO websocket error", error);
    ws.close(1011, "error");
  }
}
