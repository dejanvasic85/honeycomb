import type { Player } from "./player";

// If the host disconnects, the room waits this long before promoting a
// replacement — a brief drop shouldn't reshuffle the room. See docs/SPEC.md §3.
export const HOST_PROMOTION_DELAY_MS = 30 * 1000;

// Picks the connected player who has been continuously connected the
// longest, to replace a host that's been gone past the grace period.
// Returns null when nobody is connected (the room is effectively empty).
export function pickPromotedHost(players: Record<string, Player>): string | null {
  let candidate: Player | null = null;
  for (const player of Object.values(players)) {
    if (!player.connected) continue;
    if (!candidate || player.connectedSince < candidate.connectedSince) {
      candidate = player;
    }
  }
  return candidate?.id ?? null;
}
