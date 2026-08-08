import { DurableObject } from "cloudflare:workers";

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
    if (request.headers.get("Upgrade") !== "websocket") {
      // Plain HTTP ping, used by the /debug bindings check.
      return new Response("pong");
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    if (isRecord(parsed) && parsed.type === "ping") {
      const pong = JSON.stringify({ type: "pong", wakeCount: this.wakeCount });
      for (const socket of this.ctx.getWebSockets()) {
        socket.send(pong);
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, reason);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("RoomDO websocket error", error);
    ws.close(1011, "error");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
