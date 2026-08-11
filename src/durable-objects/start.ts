import { MIN_PLAYERS_TO_START } from "#/lib/lobby";

import { canTransition } from "./phase";
import type { Phase } from "./phase";
import type { Player } from "./player";

export interface StartRejection {
  code: "not_host" | "not_enough_players" | "invalid_phase";
  message: string;
}

// Pure authorisation check for the host `start` action — kept separate from
// RoomDO so it's unit-testable without simulating ctx.storage/WebSockets.
// Returns null when `start` is allowed.
export function checkStart(
  phase: Phase,
  hostId: string | null,
  playerId: string,
  players: Record<string, Player>,
): StartRejection | null {
  if (playerId !== hostId) {
    return { code: "not_host", message: "Only the host can start the game." };
  }

  const connectedCount = Object.values(players).filter((player) => player.connected).length;
  if (connectedCount < MIN_PLAYERS_TO_START) {
    return { code: "not_enough_players", message: "Need more players to start." };
  }

  if (!canTransition(phase, "question")) {
    return { code: "invalid_phase", message: "The game has already started." };
  }

  return null;
}
