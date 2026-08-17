import { describe, expect, it } from "vite-plus/test";

import type { Answer } from "./answer";
import { clusterAnswers, clusterAnswersExact } from "./cluster";
import type { ClusterLLMClient } from "./llm-cluster";

function makeAnswer(overrides: Partial<Answer> & Pick<Answer, "playerId">): Answer {
  return { text: `${overrides.playerId}'s answer`, submittedAt: 0, ...overrides };
}

describe("clusterAnswersExact", () => {
  it("returns an empty array for no answers", () => {
    expect(clusterAnswersExact({})).toEqual([]);
  });

  it("groups answers that are identical after normalisation", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "Pizza", submittedAt: 1 }),
      p2: makeAnswer({ playerId: "p2", text: "  pizza  ", submittedAt: 2 }),
      p3: makeAnswer({ playerId: "p3", text: "PIZZA!", submittedAt: 3 }),
    };

    const clusters = clusterAnswersExact(answers);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].playerIds).toEqual(["p1", "p2", "p3"]);
  });

  it("ignores punctuation and collapses internal whitespace when matching", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "Mac and Cheese", submittedAt: 1 }),
      p2: makeAnswer({ playerId: "p2", text: "mac   and cheese.", submittedAt: 2 }),
    };

    expect(clusterAnswersExact(answers)).toHaveLength(1);
  });

  it("keeps distinct answers in separate singleton clusters", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "Pizza", submittedAt: 1 }),
      p2: makeAnswer({ playerId: "p2", text: "Tacos", submittedAt: 2 }),
    };

    const clusters = clusterAnswersExact(answers);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.playerIds)).toEqual([["p1"], ["p2"]]);
  });

  it("picks the earliest-submitted original text as the canonical label", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "mcdonald's", submittedAt: 2 }),
      p2: makeAnswer({ playerId: "p2", text: "McDonald's", submittedAt: 1 }),
    };

    const clusters = clusterAnswersExact(answers);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].canonical).toBe("McDonald's");
  });

  it("does not drop any answer — every player ends up in exactly one cluster", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "Dogs", submittedAt: 1 }),
      p2: makeAnswer({ playerId: "p2", text: "Cats", submittedAt: 2 }),
      p3: makeAnswer({ playerId: "p3", text: "dogs", submittedAt: 3 }),
    };

    const clusters = clusterAnswersExact(answers);
    const allPlayerIds = clusters.flatMap((c) => c.playerIds).sort();

    expect(allPlayerIds).toEqual(["p1", "p2", "p3"]);
  });
});

function fakeClient(complete: ClusterLLMClient["complete"]): ClusterLLMClient {
  return { complete };
}

describe("clusterAnswers", () => {
  const answers: Record<string, Answer> = {
    p1: makeAnswer({ playerId: "p1", text: "McDonald's", submittedAt: 1 }),
    p2: makeAnswer({ playerId: "p2", text: "Maccas", submittedAt: 2 }),
  };

  it("falls back to v0 exact-match when no LLM client is supplied", async () => {
    const clusters = await clusterAnswers(answers);

    expect(clusters).toHaveLength(2);
  });

  it("uses the LLM result when the client returns a valid clustering", async () => {
    const client = fakeClient(async () =>
      JSON.stringify({ clusters: [{ canonical: "McDonald's", playerIds: ["p1", "p2"] }] }),
    );

    const clusters = await clusterAnswers(answers, client);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].playerIds).toEqual(["p1", "p2"]);
  });

  it("falls back to v0 when the LLM client throws", async () => {
    const client = fakeClient(async () => {
      throw new Error("network error");
    });

    const clusters = await clusterAnswers(answers, client);

    expect(clusters).toHaveLength(2);
  });

  it("falls back to v0 when the LLM response is malformed", async () => {
    const client = fakeClient(async () => "not json");

    const clusters = await clusterAnswers(answers, client);

    expect(clusters).toHaveLength(2);
  });
});
