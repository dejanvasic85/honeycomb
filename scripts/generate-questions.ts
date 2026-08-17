#!/usr/bin/env node
// Step 1 of the pipeline in docs/SPEC.md §5: prompt Claude for N questions in
// a category + age band, dedupe against the existing bank, dump a review
// file. Never writes to D1 directly — that only happens after a human
// approves rows in the review file (see apply-approved-questions.ts).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  AGE_BANDS,
  CATEGORIES,
  buildQuestionGenerationPrompt,
  dedupeCandidates,
  isAgeBand,
  isCategory,
  parseGeneratedQuestions,
  toCandidateRows,
} from "./question-gen/candidate.ts";
import { createAnthropicQuestionGenClient } from "./question-gen/client.ts";
import { fetchExistingQuestionTexts } from "./question-gen/d1.ts";

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (!key || value === undefined) {
      throw new Error(`Malformed argument near "${argv[i]}"`);
    }
    args.set(key, value);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const category = args.get("category");
  if (!category || !isCategory(category)) {
    throw new Error(`--category must be one of: ${CATEGORIES.join(", ")}`);
  }
  const ageBand = args.get("age-band");
  if (!ageBand || !isAgeBand(ageBand)) {
    throw new Error(`--age-band must be one of: ${AGE_BANDS.join(", ")}`);
  }
  const count = Number(args.get("count") ?? "10");
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new Error("--count must be an integer between 1 and 50");
  }
  const locale = args.get("locale") ?? "en-AU";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Run with: node --env-file=.dev.vars scripts/generate-questions.ts ...",
    );
  }

  const client = createAnthropicQuestionGenClient(apiKey);
  const prompt = buildQuestionGenerationPrompt({ category, ageBand, count, locale });

  const raw = await client.complete(prompt);
  const texts = parseGeneratedQuestions(raw);
  if (!texts) {
    throw new Error(`Claude's response was not valid JSON in the expected shape:\n${raw}`);
  }

  const candidates = toCandidateRows(texts, { category, ageBand, locale });

  const existingTexts = fetchExistingQuestionTexts({ local: true });
  const deduped = dedupeCandidates(candidates, existingTexts);
  const dropped = candidates.length - deduped.length;

  const reviewDir = join(process.cwd(), "review");
  mkdirSync(reviewDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = args.get("out") ?? join(reviewDir, `${category}-${ageBand}-${stamp}.json`);
  writeFileSync(outPath, `${JSON.stringify(deduped, null, 2)}\n`);

  console.log(
    `Generated ${texts.length} candidate(s), ${dropped} duplicate(s) dropped, ` +
      `${deduped.length} written to ${outPath}.`,
  );
  console.log(
    'Review the file: set "approved": true on rows to keep, then run ' +
      "scripts/apply-approved-questions.ts on it.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
