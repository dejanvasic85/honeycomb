import { z } from "zod";

import { PlayerName } from "./player";
import type { Player } from "./player";

const PingMessage = z.object({ type: z.literal("ping") });
const JoinMessage = z.object({ type: z.literal("join"), name: PlayerName });
const RejoinMessage = z.object({ type: z.literal("rejoin"), playerId: z.string() });

export const ClientMessage = z.discriminatedUnion("type", [
  PingMessage,
  JoinMessage,
  RejoinMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export function buildPongMessage(wakeCount: number): string {
  return JSON.stringify({ type: "pong", wakeCount });
}

export function buildJoinedMessage(player: Player): string {
  return JSON.stringify({ type: "joined", player });
}

export function buildPlayerJoinedMessage(player: Player): string {
  return JSON.stringify({ type: "playerJoined", player });
}

export function buildPlayerLeftMessage(player: Player): string {
  return JSON.stringify({ type: "playerLeft", player });
}

export function buildErrorMessage(code: string, message: string): string {
  return JSON.stringify({ type: "error", code, message });
}
