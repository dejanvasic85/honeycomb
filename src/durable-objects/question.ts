export interface Question {
  id: string;
  text: string;
  category: string;
}

// Picks a random question, excluding anything already used this game.
// Exhaustion policy: if every question in `pool` has been used, fall back to
// the full pool (repeats allowed) rather than erroring — the spec doesn't
// define a bank-exhaustion policy (docs/SPEC.md §9 open question), and with
// only 20 seed questions (#11) this triggers well before the real
// 300-question bank (#21) ships. An empty pool (no approved questions at
// all) returns null.
export function pickQuestion(
  pool: readonly Question[],
  usedQuestionIds: readonly string[],
  random: () => number = Math.random,
): Question | null {
  if (pool.length === 0) return null;

  const unused = pool.filter((question) => !usedQuestionIds.includes(question.id));
  const candidates = unused.length > 0 ? unused : pool;

  return candidates[Math.floor(random() * candidates.length)];
}
