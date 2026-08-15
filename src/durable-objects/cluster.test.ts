import { describe, expect, it } from "vite-plus/test";

import type { Answer } from "./answer";
import { clusterAnswers } from "./cluster";

function makeAnswer(overrides: Partial<Answer> & Pick<Answer, "playerId">): Answer {
  return { text: `${overrides.playerId}'s answer`, submittedAt: 0, ...overrides };
}

describe("clusterAnswers", () => {
  it("returns an empty array for no answers", () => {
    expect(clusterAnswers({})).toEqual([]);
  });

  it("groups answers that are identical after normalisation", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "Pizza", submittedAt: 1 }),
      p2: makeAnswer({ playerId: "p2", text: "  pizza  ", submittedAt: 2 }),
      p3: makeAnswer({ playerId: "p3", text: "PIZZA!", submittedAt: 3 }),
    };

    const clusters = clusterAnswers(answers);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].playerIds).toEqual(["p1", "p2", "p3"]);
  });

  it("ignores punctuation and collapses internal whitespace when matching", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "Mac and Cheese", submittedAt: 1 }),
      p2: makeAnswer({ playerId: "p2", text: "mac   and cheese.", submittedAt: 2 }),
    };

    expect(clusterAnswers(answers)).toHaveLength(1);
  });

  it("keeps distinct answers in separate singleton clusters", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "Pizza", submittedAt: 1 }),
      p2: makeAnswer({ playerId: "p2", text: "Tacos", submittedAt: 2 }),
    };

    const clusters = clusterAnswers(answers);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.playerIds)).toEqual([["p1"], ["p2"]]);
  });

  it("picks the earliest-submitted original text as the canonical label", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "mcdonald's", submittedAt: 2 }),
      p2: makeAnswer({ playerId: "p2", text: "McDonald's", submittedAt: 1 }),
    };

    const clusters = clusterAnswers(answers);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].canonical).toBe("McDonald's");
  });

  it("does not drop any answer — every player ends up in exactly one cluster", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "Dogs", submittedAt: 1 }),
      p2: makeAnswer({ playerId: "p2", text: "Cats", submittedAt: 2 }),
      p3: makeAnswer({ playerId: "p3", text: "dogs", submittedAt: 3 }),
    };

    const clusters = clusterAnswers(answers);
    const allPlayerIds = clusters.flatMap((c) => c.playerIds).sort();

    expect(allPlayerIds).toEqual(["p1", "p2", "p3"]);
  });
});
