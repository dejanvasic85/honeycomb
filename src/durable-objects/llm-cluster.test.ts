import { describe, expect, it } from "vite-plus/test";

import type { Answer } from "./answer";
import { buildClusterPrompt, clusterAnswersWithLLM, parseClusterResponse } from "./llm-cluster";
import type { ClusterLLMClient } from "./llm-cluster";

function makeAnswer(overrides: Partial<Answer> & Pick<Answer, "playerId">): Answer {
  return { text: `${overrides.playerId}'s answer`, submittedAt: 0, ...overrides };
}

describe("buildClusterPrompt", () => {
  it("includes every player id and their raw answer text", () => {
    const answers: Record<string, Answer> = {
      p1: makeAnswer({ playerId: "p1", text: "McDonald's", submittedAt: 1 }),
      p2: makeAnswer({ playerId: "p2", text: "Maccas", submittedAt: 2 }),
    };

    const prompt = buildClusterPrompt(answers);

    expect(prompt).toContain("p1: McDonald's");
    expect(prompt).toContain("p2: Maccas");
  });
});

describe("parseClusterResponse", () => {
  const answers: Record<string, Answer> = {
    p1: makeAnswer({ playerId: "p1", text: "McDonald's", submittedAt: 1 }),
    p2: makeAnswer({ playerId: "p2", text: "Maccas", submittedAt: 2 }),
  };

  it("returns clusters for a valid, complete response", () => {
    const raw = JSON.stringify({
      clusters: [{ canonical: "McDonald's", playerIds: ["p1", "p2"] }],
    });

    const clusters = parseClusterResponse(raw, answers);

    expect(clusters).toHaveLength(1);
    expect(clusters?.[0].playerIds).toEqual(["p1", "p2"]);
    expect(clusters?.[0].canonical).toBe("McDonald's");
  });

  it("returns null for unparseable JSON", () => {
    expect(parseClusterResponse("not json", answers)).toBeNull();
  });

  it("returns null when the response doesn't match the expected shape", () => {
    expect(parseClusterResponse(JSON.stringify({ oops: true }), answers)).toBeNull();
  });

  it("returns null when a player id is missing from every cluster", () => {
    const raw = JSON.stringify({ clusters: [{ canonical: "McDonald's", playerIds: ["p1"] }] });

    expect(parseClusterResponse(raw, answers)).toBeNull();
  });

  it("returns null when a player id appears in more than one cluster", () => {
    const raw = JSON.stringify({
      clusters: [
        { canonical: "McDonald's", playerIds: ["p1", "p2"] },
        { canonical: "Maccas", playerIds: ["p2"] },
      ],
    });

    expect(parseClusterResponse(raw, answers)).toBeNull();
  });

  it("returns null when the response references a player id that wasn't asked", () => {
    const raw = JSON.stringify({
      clusters: [{ canonical: "McDonald's", playerIds: ["p1", "p2", "p3"] }],
    });

    expect(parseClusterResponse(raw, answers)).toBeNull();
  });
});

function fakeClient(complete: ClusterLLMClient["complete"]): ClusterLLMClient {
  return { complete };
}

describe("clusterAnswersWithLLM", () => {
  const answers: Record<string, Answer> = {
    p1: makeAnswer({ playerId: "p1", text: "McDonald's", submittedAt: 1 }),
    p2: makeAnswer({ playerId: "p2", text: "Maccas", submittedAt: 2 }),
  };

  it("returns clusters parsed from a successful client response", async () => {
    const client = fakeClient(async () =>
      JSON.stringify({ clusters: [{ canonical: "McDonald's", playerIds: ["p1", "p2"] }] }),
    );

    const clusters = await clusterAnswersWithLLM(answers, client);

    expect(clusters).toHaveLength(1);
  });

  it("returns null when the client throws", async () => {
    const client = fakeClient(async () => {
      throw new Error("api error");
    });

    expect(await clusterAnswersWithLLM(answers, client)).toBeNull();
  });

  it("returns null when the client never resolves within the timeout", async () => {
    const client = fakeClient(() => new Promise<string>(() => {}));

    expect(await clusterAnswersWithLLM(answers, client, 10)).toBeNull();
  });

  it("returns null when the client's response is malformed", async () => {
    const client = fakeClient(async () => "not json");

    expect(await clusterAnswersWithLLM(answers, client)).toBeNull();
  });
});
