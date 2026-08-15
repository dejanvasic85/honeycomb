import type { Answer } from "./answer";

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
// The LLM-backed v1 (#20) sits behind this same signature and falls back to
// this on error/timeout, so the shape here — a plain function from answers to
// clusters — is load-bearing, not incidental.
export function clusterAnswers(answers: Record<string, Answer>): Cluster[] {
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
