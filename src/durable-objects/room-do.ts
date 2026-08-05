import { DurableObject } from "cloudflare:workers";

// Minimal binding target so the DO wiring can be verified end to end.
// Hibernation-correct WebSocket handling and real room state come later.
export class RoomDO extends DurableObject {
  async fetch(): Promise<Response> {
    return new Response("pong");
  }
}
