import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { Answer } from "./answer";
import type { Cluster } from "./cluster";

// v1 clustering per docs/SPEC.md §6: a single Claude Haiku call judging
// semantic equivalence, behind a narrow interface so tests never need the
// real SDK or a network call.
export interface ClusterLLMClient {
  complete(prompt: string): Promise<string>;
}

const LLM_CLUSTER_MODEL = "claude-haiku-4-5-20251001";
const LLM_CLUSTER_TIMEOUT_MS = 6000;
const LLM_CLUSTER_MAX_TOKENS = 1024;

const LLMClusterResponseSchema = z.object({
  clusters: z.array(z.object({ canonical: z.string(), playerIds: z.array(z.string()) })),
});

// Pure prompt construction — one line per player, so the model sees exactly
// what a human judge at the table would.
export function buildClusterPrompt(answers: Record<string, Answer>): string {
  const lines = Object.values(answers)
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((answer) => `${answer.playerId}: ${answer.text}`);

  return [
    "Group these player answers into clusters of semantically equivalent answers.",
    "Two answers match if a reasonable person would call them the same answer to " +
      "the question — synonyms, spelling variants, abbreviations, and different " +
      'names for the same thing all count (e.g. "McDonald\'s", "Maccas", "Macca\'s" ' +
      "are one cluster). Distinct answers must NOT be merged.",
    "Every player id below must appear in exactly one cluster's playerIds array.",
    "canonical should be the clearest of the matched answers' original text, verbatim.",
    "",
    "Answers:",
    ...lines,
    "",
    "Respond with ONLY JSON matching this shape, no other text: " +
      '{ "clusters": [{ "canonical": string, "playerIds": string[] }] }',
  ].join("\n");
}

// Pure validation: the LLM's JSON must be well-formed AND account for every
// submitted answer exactly once. Anything else is untrustworthy output — the
// caller falls back to v0 rather than risk dropping or duplicating a player.
export function parseClusterResponse(
  raw: string,
  answers: Record<string, Answer>,
): Cluster[] | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = LLMClusterResponseSchema.safeParse(json);
  if (!result.success) return null;

  const expected = new Set(Object.keys(answers));
  const seen = new Set<string>();
  for (const cluster of result.data.clusters) {
    for (const playerId of cluster.playerIds) {
      if (!expected.has(playerId) || seen.has(playerId)) return null;
      seen.add(playerId);
    }
  }
  if (seen.size !== expected.size) return null;

  return result.data.clusters.map((cluster) => ({
    id: crypto.randomUUID(),
    canonical: cluster.canonical,
    playerIds: cluster.playerIds,
  }));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("cluster LLM call timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Never throws — any API error, timeout, or unparseable/invalid response
// resolves to null so the DO can fall back to v0 without stalling the round.
export async function clusterAnswersWithLLM(
  answers: Record<string, Answer>,
  client: ClusterLLMClient,
  timeoutMs: number = LLM_CLUSTER_TIMEOUT_MS,
): Promise<Cluster[] | null> {
  let raw: string;
  try {
    raw = await withTimeout(client.complete(buildClusterPrompt(answers)), timeoutMs);
  } catch {
    return null;
  }

  return parseClusterResponse(raw, answers);
}

export function createAnthropicClusterClient(apiKey: string): ClusterLLMClient {
  const anthropic = new Anthropic({ apiKey });

  return {
    async complete(prompt: string): Promise<string> {
      const message = await anthropic.messages.create({
        model: LLM_CLUSTER_MODEL,
        max_tokens: LLM_CLUSTER_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });

      const block = message.content.find((b) => b.type === "text");
      if (!block) {
        throw new Error("Anthropic response had no text content block");
      }
      return block.text;
    },
  };
}
