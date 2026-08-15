import { describe, expect, it } from "vite-plus/test";

import type { Cluster } from "#/durable-objects/cluster";

import { clusterTier, sortClustersForReveal } from "./reveal";

describe("clusterTier", () => {
  it("maps 1:1 below the clamp", () => {
    expect(clusterTier(1)).toBe(1);
    expect(clusterTier(2)).toBe(2);
    expect(clusterTier(3)).toBe(3);
    expect(clusterTier(4)).toBe(4);
  });

  it("clamps at 4 for larger clusters", () => {
    expect(clusterTier(5)).toBe(4);
    expect(clusterTier(20)).toBe(4);
  });
});

describe("sortClustersForReveal", () => {
  function cluster(id: string, playerCount: number): Cluster {
    return { id, canonical: id, playerIds: Array.from({ length: playerCount }, () => "p") };
  }

  it("puts the largest cluster first", () => {
    const clusters = [cluster("a", 1), cluster("b", 3), cluster("c", 2)];
    expect(sortClustersForReveal(clusters).map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("is stable on ties, preserving original order", () => {
    const clusters = [cluster("a", 2), cluster("b", 2), cluster("c", 1)];
    expect(sortClustersForReveal(clusters).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for empty input", () => {
    expect(sortClustersForReveal([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const clusters = [cluster("a", 1), cluster("b", 3)];
    const original = [...clusters];
    sortClustersForReveal(clusters);
    expect(clusters).toEqual(original);
  });
});
