import { z } from "zod";

export const ClientMessage = z.object({
  type: z.literal("ping"),
});
export type ClientMessage = z.infer<typeof ClientMessage>;

export function buildPongMessage(wakeCount: number): string {
  return JSON.stringify({ type: "pong", wakeCount });
}
