import { describe, expect, it } from "vite-plus/test";

import type { Player } from "./player";
import { checkStart } from "./start";

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

const threeConnectedPlayers: Record<string, Player> = {
  p1: makePlayer({ id: "p1" }),
  p2: makePlayer({ id: "p2" }),
  p3: makePlayer({ id: "p3" }),
};

describe("checkStart", () => {
  it("allows the host to start with enough players", () => {
    expect(checkStart("lobby", "p1", "p1", threeConnectedPlayers)).toBeNull();
  });

  it("rejects a non-host", () => {
    expect(checkStart("lobby", "p1", "p2", threeConnectedPlayers)).toEqual({
      code: "not_host",
      message: "Only the host can start the game.",
    });
  });

  it("rejects below the minimum player count", () => {
    const twoPlayers: Record<string, Player> = {
      p1: makePlayer({ id: "p1" }),
      p2: makePlayer({ id: "p2" }),
    };
    expect(checkStart("lobby", "p1", "p1", twoPlayers)).toEqual({
      code: "not_enough_players",
      message: "Need more players to start.",
    });
  });

  it("only counts connected players toward the minimum", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ id: "p1" }),
      p2: makePlayer({ id: "p2" }),
      p3: makePlayer({ id: "p3", connected: false }),
    };
    expect(checkStart("lobby", "p1", "p1", players)).toEqual({
      code: "not_enough_players",
      message: "Need more players to start.",
    });
  });

  it("rejects starting from a phase that isn't lobby", () => {
    expect(checkStart("answering", "p1", "p1", threeConnectedPlayers)).toEqual({
      code: "invalid_phase",
      message: "The game has already started.",
    });
  });
});
