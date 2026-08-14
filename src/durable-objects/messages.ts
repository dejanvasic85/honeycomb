import { z } from "zod";

import { AnswerText } from "./answer";
import type { Cluster } from "./cluster";
import { PHASES } from "./phase";
import type { Phase } from "./phase";
import { PlayerName } from "./player";
import type { Player } from "./player";
import type { SanitisedRoom } from "./sanitise";

const PingMessage = z.object({ type: z.literal("ping") });
const JoinMessage = z.object({ type: z.literal("join"), name: PlayerName });
const RejoinMessage = z.object({ type: z.literal("rejoin"), playerId: z.string() });
const StartMessage = z.object({ type: z.literal("start") });
const SubmitAnswerMessage = z.object({ type: z.literal("submitAnswer"), text: AnswerText });

export const ClientMessage = z.discriminatedUnion("type", [
  PingMessage,
  JoinMessage,
  RejoinMessage,
  StartMessage,
  SubmitAnswerMessage,
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

const PhaseSchema = z.enum(PHASES);

const PongMessage = z.object({ type: z.literal("pong"), wakeCount: z.number() });
const JoinedMessage = z.object({ type: z.literal("joined"), player: PlayerSchema });
const PlayerJoinedMessage = z.object({ type: z.literal("playerJoined"), player: PlayerSchema });
const PlayerLeftMessage = z.object({ type: z.literal("playerLeft"), player: PlayerSchema });
const QuestionSchema = z.object({ text: z.string(), category: z.string() }).nullable();
const AnswerSchema = z.object({
  playerId: z.string(),
  text: z.string(),
  submittedAt: z.number(),
});

const ClusterSchema = z.object({
  id: z.string(),
  canonical: z.string(),
  playerIds: z.array(z.string()),
});

const StateMessage = z.object({
  type: z.literal("state"),
  code: z.string(),
  hostId: z.string().nullable(),
  players: z.array(PlayerSchema),
  phase: PhaseSchema,
  round: z.number(),
  question: QuestionSchema,
  // Pre-sanitised by sanitiseFor() — only ever the recipient's own answer
  // until phase reaches "reveal". Never build this from a raw RoomRecord.
  answers: z.record(z.string(), AnswerSchema),
  clusters: z.array(ClusterSchema).nullable(),
});
const PhaseMessage = z.object({ type: z.literal("phase"), phase: PhaseSchema });
const QuestionMessage = z.object({
  type: z.literal("question"),
  text: z.string(),
  category: z.string(),
});
const AnswerProgressMessage = z.object({
  type: z.literal("answerProgress"),
  answered: z.number(),
  total: z.number(),
});
// Sent once, on entering `reveal`. Safe to broadcast identically to every
// socket — unlike `state`, every answer is public by this phase
// (docs/SPEC.md §4).
const RevealMessage = z.object({
  type: z.literal("reveal"),
  clusters: z.array(ClusterSchema),
  answersByPlayer: z.record(z.string(), z.string()),
});
const ErrorMessage = z.object({ type: z.literal("error"), code: z.string(), message: z.string() });

// Not yet the full RoomState snapshot from docs/SPEC.md §3 (no scores yet) —
// widens as later milestones add state.
export const ServerMessage = z.discriminatedUnion("type", [
  PongMessage,
  JoinedMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  StateMessage,
  PhaseMessage,
  QuestionMessage,
  AnswerProgressMessage,
  RevealMessage,
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

// Takes the output of sanitiseFor(), never a raw RoomRecord — see
// docs/SPEC.md §4's sanitisation rule.
export function buildStateMessage(room: SanitisedRoom): string {
  return JSON.stringify({
    type: "state",
    code: room.code,
    hostId: room.hostId,
    players: Object.values(room.players),
    phase: room.phase,
    round: room.round,
    question: room.currentQuestion
      ? { text: room.currentQuestion.text, category: room.currentQuestion.category }
      : null,
    answers: room.answers,
    clusters: room.clusters,
  });
}

export function buildPhaseMessage(phase: Phase): string {
  return JSON.stringify({ type: "phase", phase });
}

export function buildQuestionMessage(text: string, category: string): string {
  return JSON.stringify({ type: "question", text, category });
}

export function buildAnswerProgressMessage(answered: number, total: number): string {
  return JSON.stringify({ type: "answerProgress", answered, total });
}

export function buildRevealMessage(
  clusters: Cluster[],
  answersByPlayer: Record<string, string>,
): string {
  return JSON.stringify({ type: "reveal", clusters, answersByPlayer });
}

export function buildErrorMessage(code: string, message: string): string {
  return JSON.stringify({ type: "error", code, message });
}
