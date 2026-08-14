import { describe, expect, it } from "vite-plus/test";

import { AnswerText, computeAnswerProgress } from "./answer";
import type { Answer } from "./answer";
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

function makeAnswer(overrides: Partial<Answer> & Pick<Answer, "playerId">): Answer {
  return { text: `${overrides.playerId}'s answer`, submittedAt: 0, ...overrides };
}

describe("AnswerText", () => {
  it("trims surrounding whitespace", () => {
    const result = AnswerText.safeParse("  Pepperoni  ");
    expect(result.success && result.data).toBe("Pepperoni");
  });

  it("rejects an empty answer", () => {
    expect(AnswerText.safeParse("   ").success).toBe(false);
  });

  it("rejects an answer over 100 characters", () => {
    expect(AnswerText.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("accepts an answer at the 100 character limit", () => {
    expect(AnswerText.safeParse("a".repeat(100)).success).toBe(true);
  });
});

describe("computeAnswerProgress", () => {
  it("counts nobody as answered when there are no answers yet", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ id: "p1" }),
      p2: makePlayer({ id: "p2" }),
    };
    expect(computeAnswerProgress(players, {})).toEqual({ answered: 0, total: 2 });
  });

  it("counts only connected players toward total", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ id: "p1" }),
      p2: makePlayer({ id: "p2", connected: false }),
    };
    expect(computeAnswerProgress(players, {})).toEqual({ answered: 0, total: 1 });
  });

  it("counts players with a stored answer as answered", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ id: "p1" }),
      p2: makePlayer({ id: "p2" }),
      p3: makePlayer({ id: "p3" }),
    };
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1" }),
      p3: makeAnswer({ playerId: "p3" }),
    };
    expect(computeAnswerProgress(players, answers)).toEqual({ answered: 2, total: 3 });
  });

  it("does not count a disconnected player's stale answer toward total", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ id: "p1", connected: false }),
      p2: makePlayer({ id: "p2" }),
    };
    const answers: Record<string, Answer> = { p1: makeAnswer({ playerId: "p1" }) };
    expect(computeAnswerProgress(players, answers)).toEqual({ answered: 0, total: 1 });
  });

  it("reports full progress once every connected player has answered", () => {
    const players: Record<string, Player> = {
      p1: makePlayer({ id: "p1" }),
      p2: makePlayer({ id: "p2" }),
    };
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1" }),
      p2: makeAnswer({ playerId: "p2" }),
    };
    expect(computeAnswerProgress(players, answers)).toEqual({ answered: 2, total: 2 });
  });
});
