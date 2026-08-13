import type { Answer } from "./answer";
import type { Phase } from "./phase";
import type { Player } from "./player";
import type { Question } from "./question";
import type { RoomRecord } from "./room-record";

// Phases from which every player's answer is safe to reveal to everyone.
// Before this, each player may only see their own.
const REVEALED_PHASES: readonly Phase[] = ["reveal", "scoring", "gameover"];

export interface SanitisedRoom {
  code: string;
  hostId: string | null;
  players: Record<string, Player>;
  phase: Phase;
  round: number;
  currentQuestion: Question | null;
  answers: Record<string, Answer>;
  // Nominal brand: RoomRecord happens to structurally satisfy every field
  // above, so without this a raw unsanitised RoomRecord would type-check as
  // a SanitisedRoom and slip straight into buildStateMessage. Only
  // sanitiseFor() can produce this shape.
  readonly __sanitised: true;
}

// The single gate every outbound state message must pass through
// (docs/SPEC.md §4). Strips every answer but the caller's own until the
// phase reaches `reveal` — this is the invariant that must never regress.
export function sanitiseFor(playerId: string, room: RoomRecord): SanitisedRoom {
  const revealed = REVEALED_PHASES.includes(room.phase);
  const ownAnswer = room.answers[playerId];

  const answers: Record<string, Answer> = revealed
    ? room.answers
    : ownAnswer
      ? { [playerId]: ownAnswer }
      : {};

  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players,
    phase: room.phase,
    round: room.round,
    currentQuestion: room.currentQuestion,
    answers,
    __sanitised: true,
  };
}
