import { describe, expect, it } from "vite-plus/test";

import type { Cluster } from "./cluster";
import type { Player } from "./player";
import { WIN_HONEY_TARGET, applyStingAndOffload, awardHoney, checkWinners } from "./score";

function makePlayer(overrides: Partial<Player> & Pick<Player, "id">): Player {
  return {
    name: overrides.id,
    connected: true,
    honey: 0,
    stung: false,
    joinedAtRound: 0,
    connectedSince: 0,
    ...overrides,
  };
}

function makeCluster(overrides: Partial<Cluster> & Pick<Cluster, "playerIds">): Cluster {
  return { id: overrides.playerIds.join("-"), canonical: "answer", ...overrides };
}

describe("awardHoney", () => {
  it("awards the sole largest cluster", () => {
    const clusters = [makeCluster({ playerIds: ["p1", "p2"] }), makeCluster({ playerIds: ["p3"] })];
    expect(awardHoney(clusters)).toEqual(["p1", "p2"]);
  });

  it("awards every cluster tied for the largest size", () => {
    const clusters = [
      makeCluster({ playerIds: ["p1", "p2"] }),
      makeCluster({ playerIds: ["p3", "p4"] }),
      makeCluster({ playerIds: ["p5"] }),
    ];
    expect(awardHoney(clusters)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("awards nobody when every cluster is a singleton", () => {
    const clusters = [makeCluster({ playerIds: ["p1"] }), makeCluster({ playerIds: ["p2"] })];
    expect(awardHoney(clusters)).toEqual([]);
  });

  it("awards nobody for an empty round", () => {
    expect(awardHoney([])).toEqual([]);
  });
});

describe("applyStingAndOffload", () => {
  it("stings a singleton-cluster player", () => {
    const players = { p1: makePlayer({ id: "p1" }) };
    const clusters = [makeCluster({ playerIds: ["p1"] })];
    expect(applyStingAndOffload(clusters, players).p1.stung).toBe(true);
  });

  it("offloads a previously stung player who matches this round", () => {
    const players = { p1: makePlayer({ id: "p1", stung: true }), p2: makePlayer({ id: "p2" }) };
    const clusters = [makeCluster({ playerIds: ["p1", "p2"] })];
    const updated = applyStingAndOffload(clusters, players);
    expect(updated.p1.stung).toBe(false);
    expect(updated.p2.stung).toBe(false);
  });

  it("leaves a non-answering player's stung value unchanged", () => {
    const players = { p1: makePlayer({ id: "p1", stung: true }) };
    expect(applyStingAndOffload([], players).p1.stung).toBe(true);
  });
});

describe("checkWinners", () => {
  it("declares a player at the target with no sting a winner", () => {
    const players = { p1: makePlayer({ id: "p1", honey: WIN_HONEY_TARGET }) };
    expect(checkWinners(players)).toEqual(["p1"]);
  });

  it("blocks a stung player from winning even above the target", () => {
    const players = { p1: makePlayer({ id: "p1", honey: WIN_HONEY_TARGET, stung: true }) };
    expect(checkWinners(players)).toEqual([]);
  });

  it("returns every player who meets the condition", () => {
    const players = {
      p1: makePlayer({ id: "p1", honey: WIN_HONEY_TARGET }),
      p2: makePlayer({ id: "p2", honey: WIN_HONEY_TARGET + 1 }),
      p3: makePlayer({ id: "p3", honey: WIN_HONEY_TARGET - 1 }),
    };
    expect(checkWinners(players)).toEqual(["p1", "p2"]);
  });
});
