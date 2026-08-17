import { z } from "zod";

// Category/age_band vocabulary per docs/SPEC.md §3 (questions table comment)
// and the seed data in migrations/0002_seed_questions.sql.
export const CATEGORIES = [
  "food",
  "animals",
  "school",
  "movies",
  "silly",
  "would-you-rather",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const AGE_BANDS = ["kids", "family", "adult"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);
const AGE_BAND_SET: ReadonlySet<string> = new Set(AGE_BANDS);

export function isCategory(value: string): value is Category {
  return CATEGORY_SET.has(value);
}

export function isAgeBand(value: string): value is AgeBand {
  return AGE_BAND_SET.has(value);
}

export const QuestionCandidateSchema = z.object({
  id: z.string(),
  text: z.string(),
  category: z.string(),
  age_band: z.string(),
  locale: z.string(),
  approved: z.boolean(),
  created_at: z.number(),
});
export type QuestionCandidate = z.infer<typeof QuestionCandidateSchema>;

// Pure prompt construction — encodes the "what makes a good question" rules
// from docs/SPEC.md §5 directly, since the LLM is the only judge of them at
// generation time (dedup and human review happen after).
export function buildQuestionGenerationPrompt(params: {
  category: Category;
  ageBand: AgeBand;
  count: number;
  locale: string;
}): string {
  const { category, ageBand, count, locale } = params;
  return [
    `Write ${count} party-game questions for the category "${category}", age band "${ageBand}", locale "${locale}".`,
    "",
    "Rules for a good question (docs/SPEC.md §5):",
    "- Has a likely majority answer, but isn't a trivia question with one objectively " +
      'correct answer. Good: "Name a topping you\'d put on a pizza." Bad: "What\'s the ' +
      'capital of France?"',
    "- Answerable in 1-3 words.",
    "- No knowledge barrier — a 7-year-old and a grandparent should both have an answer.",
    "- Culturally neutral, or explicitly suited to the given locale.",
    "- Each question must be distinct from the others in this batch.",
    "",
    "Respond with ONLY JSON matching this shape, no other text: " +
      '{ "questions": [{ "text": string }] }',
  ].join("\n");
}

const GeneratedResponseSchema = z.object({
  questions: z.array(z.object({ text: z.string().min(1) })).min(1),
});

// Pure validation of the LLM's raw response. Returns null on any malformed
// or empty output — the caller treats that as "generation failed", same
// posture as llm-cluster.ts's parseClusterResponse.
export function parseGeneratedQuestions(raw: string): string[] | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = GeneratedResponseSchema.safeParse(json);
  if (!result.success) return null;

  return result.data.questions.map((q) => q.text.trim()).filter((text) => text.length > 0);
}

// Mirrors src/durable-objects/cluster.ts's normalise: lowercase, trim,
// strip punctuation, collapse whitespace. Two questions that normalise
// identically are the same question for dedup purposes.
export function normaliseQuestionText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("-");
}

// Builds review-file rows from raw generated text, deriving a readable id
// (`category-slug`) in the same style as the hand-written seed rows, with a
// numeric suffix on collision.
export function toCandidateRows(
  texts: readonly string[],
  params: { category: Category; ageBand: AgeBand; locale: string },
  now: () => number = Date.now,
): QuestionCandidate[] {
  const usedIds = new Set<string>();
  return texts.map((text) => {
    const base = `${params.category}-${slugify(text)}`;
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    return {
      id,
      text,
      category: params.category,
      age_band: params.ageBand,
      locale: params.locale,
      approved: false,
      created_at: Math.floor(now() / 1000),
    };
  });
}

// Drops any candidate whose normalised text matches an existing bank entry
// or an earlier candidate in the same batch — dedup step of docs/SPEC.md §5
// ("simple normalised text match").
export function dedupeCandidates(
  candidates: readonly QuestionCandidate[],
  existingTexts: readonly string[],
): QuestionCandidate[] {
  const seen = new Set(existingTexts.map(normaliseQuestionText));
  const kept: QuestionCandidate[] = [];
  for (const candidate of candidates) {
    const key = normaliseQuestionText(candidate.text);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(candidate);
  }
  return kept;
}
