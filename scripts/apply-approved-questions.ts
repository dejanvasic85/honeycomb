#!/usr/bin/env node
// Step 2 of the pipeline in docs/SPEC.md §5: take a human-reviewed candidate
// file (rows flipped to "approved": true) and turn only those rows into a
// new migration. Doesn't touch D1 itself — applying the migration stays the
// existing `wrangler d1 migrations apply` flow from the README.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import {
  dedupeCandidates,
  QuestionCandidateSchema,
  type QuestionCandidate,
} from "./question-gen/candidate.ts";
import { fetchExistingQuestionTexts } from "./question-gen/d1.ts";
import { buildInsertMigrationSql, selectApproved } from "./question-gen/migration.ts";

const ReviewFileSchema = z.array(QuestionCandidateSchema);

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

function nextMigrationNumber(): string {
  const numbers = readdirSync(MIGRATIONS_DIR)
    .map((f) => /^(\d{4})_/.exec(f)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return String(next).padStart(4, "0");
}

function main() {
  const reviewPaths = process.argv.slice(2);
  if (reviewPaths.length === 0) {
    throw new Error("Usage: apply-approved-questions.ts <review-file.json> [more files...]");
  }

  const allCandidates: QuestionCandidate[] = reviewPaths.flatMap((path) => {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const result = ReviewFileSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`${path} is not a valid review file: ${result.error.message}`);
    }
    return result.data;
  });

  const approvedRows = selectApproved(allCandidates);
  if (approvedRows.length === 0) {
    console.log("No rows marked approved:true in the given file(s). Nothing to do.");
    return;
  }

  // Defensive re-check: a row could have been approved in one file while an
  // equivalent question landed in the bank (or another approved file) since
  // it was generated.
  const existingTexts = fetchExistingQuestionTexts({ local: true });
  const asCandidates: QuestionCandidate[] = approvedRows.map((row) => ({
    ...row,
    approved: true,
  }));
  const deduped = dedupeCandidates(asCandidates, existingTexts);
  const skipped = approvedRows.length - deduped.length;

  const migrationNumber = nextMigrationNumber();
  const sql = buildInsertMigrationSql(deduped, migrationNumber, new Date().toISOString());
  const outPath = join(MIGRATIONS_DIR, `${migrationNumber}_generated_questions.sql`);
  writeFileSync(outPath, sql);

  console.log(
    `Wrote ${deduped.length} approved question(s) to ${outPath}` +
      (skipped > 0 ? ` (${skipped} skipped as duplicates).` : "."),
  );
  console.log("This migration is NOT applied yet. Review it, then run:");
  console.log("  pnpm exec wrangler d1 migrations apply honeycomb --local");
}

main();
