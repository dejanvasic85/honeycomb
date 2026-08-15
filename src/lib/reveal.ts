import type { Cluster } from "#/durable-objects/cluster";

// Honey tier maps directly to cluster size, clamped at 4 — docs/SPEC.md §7.
export function clusterTier(playerCount: number): 1 | 2 | 3 | 4 {
  if (playerCount <= 1) return 1;
  if (playerCount === 2) return 2;
  if (playerCount === 3) return 3;
  return 4;
}

// Largest cluster first (centred in HexGrid's first slot), singletons trail —
// docs/SPEC.md §7 "largest cluster centre, singletons on the edge". Stable on
// ties: Array.prototype.sort is a stable sort, so equal-size clusters keep
// their original (submission) order.
export function sortClustersForReveal(clusters: Cluster[]): Cluster[] {
  return [...clusters].sort((a, b) => b.playerIds.length - a.playerIds.length);
}
