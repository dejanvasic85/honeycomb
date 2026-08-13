import type { Phase } from "./phase";
import type { Player } from "./player";

export interface SubmitAnswerRejection {
  code: "unknown_player" | "wrong_phase";
  message: string;
}

// Pure authorisation check for the `submitAnswer` client message — mirrors
// checkStart's shape so RoomDO stays thin. Resubmitting while `answering` is
// always allowed (editable-until-phase-change per docs/SPEC.md §4), so there
// is no "already answered" rejection here.
export function checkSubmitAnswer(
  phase: Phase,
  playerId: string,
  players: Record<string, Player>,
): SubmitAnswerRejection | null {
  if (!(playerId in players)) {
    return { code: "unknown_player", message: "Join the room before answering." };
  }

  if (phase !== "answering") {
    return { code: "wrong_phase", message: "Answers aren't open right now." };
  }

  return null;
}
