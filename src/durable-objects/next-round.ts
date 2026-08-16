import type { Phase } from "./phase";

export interface NextRoundRejection {
  code: "not_host" | "invalid_phase";
  message: string;
}

// Pure authorisation check for the host `nextRound` action — mirrors
// checkStart's shape. `scoring` is the only phase a next round can be
// started from; `gameover` has no next round.
export function checkNextRound(
  phase: Phase,
  hostId: string | null,
  playerId: string,
): NextRoundRejection | null {
  if (playerId !== hostId) {
    return { code: "not_host", message: "Only the host can start the next round." };
  }

  if (phase !== "scoring") {
    return { code: "invalid_phase", message: "There's no round to start yet." };
  }

  return null;
}
