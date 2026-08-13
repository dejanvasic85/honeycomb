import { describe, expect, it } from "vite-plus/test";

import type { Player } from "./player";
import { checkSubmitAnswer } from "./submit-answer";

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

const players: Record<string, Player> = {
  p1: makePlayer({ id: "p1" }),
  p2: makePlayer({ id: "p2" }),
};

describe("checkSubmitAnswer", () => {
  it("allows a known player to submit during answering", () => {
    expect(checkSubmitAnswer("answering", "p1", players)).toBeNull();
  });

  it("rejects an unknown player", () => {
    expect(checkSubmitAnswer("answering", "ghost", players)).toEqual({
      code: "unknown_player",
      message: "Join the room before answering.",
    });
  });

  it("rejects submission outside the answering phase", () => {
    for (const phase of [
      "lobby",
      "question",
      "judging",
      "reveal",
      "scoring",
      "gameover",
    ] as const) {
      expect(checkSubmitAnswer(phase, "p1", players)).toEqual({
        code: "wrong_phase",
        message: "Answers aren't open right now.",
      });
    }
  });

  it("allows resubmission during answering (editable until phase change)", () => {
    expect(checkSubmitAnswer("answering", "p1", players)).toBeNull();
    expect(checkSubmitAnswer("answering", "p1", players)).toBeNull();
  });
});
