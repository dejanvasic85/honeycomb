import { describe, expect, it } from "vite-plus/test";

import { MIN_PLAYERS_TO_START, getStartDisabledReason } from "./lobby";

describe("getStartDisabledReason", () => {
  it("disables with a singular reason at 2 players", () => {
    expect(getStartDisabledReason(2)).toBe("Need 1 more player to start (2/3)");
  });

  it("disables with a plural reason at 1 player", () => {
    expect(getStartDisabledReason(1)).toBe("Need 2 more players to start (1/3)");
  });

  it("disables at 0 players", () => {
    expect(getStartDisabledReason(0)).toBe("Need 3 more players to start (0/3)");
  });

  it("enables at the minimum", () => {
    expect(getStartDisabledReason(MIN_PLAYERS_TO_START)).toBeNull();
  });

  it("enables above the minimum", () => {
    expect(getStartDisabledReason(MIN_PLAYERS_TO_START + 5)).toBeNull();
  });
});
