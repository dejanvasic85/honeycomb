import { z } from "zod";

import { PlayerName } from "./player";
import type { Player } from "./player";
import type { RoomRecord } from "./room-record";

const PingMessage = z.object({ type: z.literal("ping") });
const JoinMessage = z.object({ type: z.literal("join"), name: PlayerName });
const RejoinMessage = z.object({ type: z.literal("rejoin"), playerId: z.string() });

export const ClientMessage = z.discriminatedUnion("type", [
  PingMessage,
  JoinMessage,
  RejoinMessage,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  connected: z.boolean(),
  honey: z.number(),
  stung: z.boolean(),
  joinedAtRound: z.number(),
  connectedSince: z.number(),
});

const PongMessage = z.object({ type: z.literal("pong"), wakeCount: z.number() });
const JoinedMessage = z.object({ type: z.literal("joined"), player: PlayerSchema });
const PlayerJoinedMessage = z.object({ type: z.literal("playerJoined"), player: PlayerSchema });
const PlayerLeftMessage = z.object({ type: z.literal("playerLeft"), player: PlayerSchema });
const StateMessage = z.object({
  type: z.literal("state"),
  code: z.string(),
  hostId: z.string().nullable(),
  players: z.array(PlayerSchema),
});
const ErrorMessage = z.object({ type: z.literal("error"), code: z.string(), message: z.string() });

// Not yet the full RoomState snapshot from docs/SPEC.md §3 (no phase/round/
// answers) — just enough for the lobby roster. Widens as later milestones add
// state.
export const ServerMessage = z.discriminatedUnion("type", [
  PongMessage,
  JoinedMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  StateMessage,
  ErrorMessage,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

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

export function buildStateMessage(room: Pick<RoomRecord, "code" | "hostId" | "players">): string {
  return JSON.stringify({
    type: "state",
    code: room.code,
    hostId: room.hostId,
    players: Object.values(room.players),
  });
}

export function buildErrorMessage(code: string, message: string): string {
  return JSON.stringify({ type: "error", code, message });
}
