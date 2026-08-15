import type { Cluster } from "./cluster";
import type { Player } from "./player";

// First to this many honey wins — docs/SPEC.md §1.
export const WIN_HONEY_TARGET = 8;

// Every player in every cluster tied for the round's largest size, as long as
// that size is >= 2. A round where nobody matched anybody (max size 1) awards
// no honey at all.
export function awardHoney(clusters: readonly Cluster[]): string[] {
  const maxSize = clusters.reduce((max, cluster) => Math.max(max, cluster.playerIds.length), 0);
  if (maxSize < 2) return [];

  return clusters
    .filter((cluster) => cluster.playerIds.length === maxSize)
    .flatMap((cluster) => cluster.playerIds);
}

// `stung` is a flag, not a streak counter: a singleton-cluster answer sets it,
// landing in a cluster of size >= 2 in any later round clears it (the
// "offload"). Players absent from every cluster this round (e.g. disconnected
// before answering) keep whatever `stung` value they already had.
export function applyStingAndOffload(
  clusters: readonly Cluster[],
  players: Record<string, Player>,
): Record<string, Player> {
  const updated: Record<string, Player> = { ...players };

  for (const cluster of clusters) {
    const stung = cluster.playerIds.length === 1;
    for (const playerId of cluster.playerIds) {
      const player = updated[playerId];
      if (!player) continue;
      updated[playerId] = { ...player, stung };
    }
  }

  return updated;
}

// A stung player can't win even at/above the honey target — they must
// offload first (docs/SPEC.md §1).
export function checkWinners(players: Record<string, Player>): string[] {
  return Object.values(players)
    .filter((player) => player.honey >= WIN_HONEY_TARGET && !player.stung)
    .map((player) => player.id);
}
