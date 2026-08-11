import { describe, expect, it } from "vite-plus/test";

import { pickPromotedHost } from "./host";
import type { Player } from "./player";

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

describe("pickPromotedHost", () => {
  it("returns null when no players are connected", () => {
    const players = { p1: makePlayer({ id: "p1", connected: false }) };
    expect(pickPromotedHost(players)).toBeNull();
  });

  it("returns null for an empty room", () => {
    expect(pickPromotedHost({})).toBeNull();
  });

  it("picks the sole connected player", () => {
    const players = {
      p1: makePlayer({ id: "p1", connected: false }),
      p2: makePlayer({ id: "p2", connected: true, connectedSince: 100 }),
    };
    expect(pickPromotedHost(players)).toBe("p2");
  });

  it("picks the connected player with the earliest connectedSince", () => {
    const players = {
      p1: makePlayer({ id: "p1", connected: true, connectedSince: 500 }),
      p2: makePlayer({ id: "p2", connected: true, connectedSince: 100 }),
      p3: makePlayer({ id: "p3", connected: true, connectedSince: 300 }),
    };
    expect(pickPromotedHost(players)).toBe("p2");
  });

  it("ignores connectedSince of disconnected players", () => {
    const players = {
      p1: makePlayer({ id: "p1", connected: false, connectedSince: 1 }),
      p2: makePlayer({ id: "p2", connected: true, connectedSince: 200 }),
    };
    expect(pickPromotedHost(players)).toBe("p2");
  });
});
