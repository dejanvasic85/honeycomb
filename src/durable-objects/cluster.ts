import type { Answer } from "./answer";
import { clusterAnswersWithLLM } from "./llm-cluster";
import type { ClusterLLMClient } from "./llm-cluster";

export interface Cluster {
  id: string;
  canonical: string; // display label — the first-submitted original text
  playerIds: string[];
}

// lowercase, trim, collapse internal whitespace, strip punctuation — two
// answers that normalise identically land in the same cluster.
function normalise(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

// v0 clustering per docs/SPEC.md §6: exact match on the normalised text.
// Deterministic and free, so it's both the baseline implementation and the
// fallback clusterAnswers() reaches for whenever the v1 LLM path (#20) is
// unavailable or untrustworthy.
export function clusterAnswersExact(answers: Record<string, Answer>): Cluster[] {
  const ordered = Object.values(answers).sort((a, b) => a.submittedAt - b.submittedAt);

  const byNormalised = new Map<string, Cluster>();
  for (const answer of ordered) {
    const key = normalise(answer.text);
    const existing = byNormalised.get(key);
    if (existing) {
      existing.playerIds.push(answer.playerId);
      continue;
    }
    byNormalised.set(key, {
      id: crypto.randomUUID(),
      canonical: answer.text,
      playerIds: [answer.playerId],
    });
  }

  return Array.from(byNormalised.values());
}

// Public entrypoint per docs/SPEC.md §6: `clusterAnswers(answers): Promise<Cluster[]>`
// behind an interface. Tries the LLM-backed v1 when a client is supplied,
// falling back to the deterministic v0 exact-match on any error, timeout, or
// malformed response — so a live round with kids on screen never stalls on a
// bad LLM call.
export async function clusterAnswers(
  answers: Record<string, Answer>,
  llmClient?: ClusterLLMClient,
): Promise<Cluster[]> {
  if (llmClient) {
    const llmResult = await clusterAnswersWithLLM(answers, llmClient);
    if (llmResult) return llmResult;
  }

  return clusterAnswersExact(answers);
}
