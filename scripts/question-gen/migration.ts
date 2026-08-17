import type { QuestionCandidate } from "./candidate.ts";

export interface ApprovedQuestionRow {
  id: string;
  text: string;
  category: string;
  age_band: string;
  locale: string;
  created_at: number;
}

// Only rows a human explicitly flipped to approved:true in the review file
// go on to become a migration — the approval gate from docs/SPEC.md §5
// ("Human approves -> approved = 1 -> insert into D1") happens by editing
// the JSON file on disk, not inside this script.
export function selectApproved(candidates: readonly QuestionCandidate[]): ApprovedQuestionRow[] {
  return candidates
    .filter((c) => c.approved)
    .map(({ id, text, category, age_band, locale, created_at }) => ({
      id,
      text,
      category,
      age_band,
      locale,
      created_at,
    }));
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

// Emits a migration in the same INSERT OR IGNORE shape as
// migrations/0002_seed_questions.sql, with approved = 1 (these rows already
// passed human review). The caller is responsible for writing this to the
// next-numbered file under migrations/ — applying it is the existing
// `wrangler d1 migrations apply` flow, unchanged.
export function buildInsertMigrationSql(
  rows: readonly ApprovedQuestionRow[],
  migrationNumber: string,
  timestampIso: string,
): string {
  const header = `-- Migration number: ${migrationNumber} \t ${timestampIso}`;
  if (rows.length === 0) {
    return `${header}\n\n-- No approved rows.\n`;
  }

  const values = rows
    .map((row) => {
      const id = escapeSqlString(row.id);
      const text = escapeSqlString(row.text);
      const category = escapeSqlString(row.category);
      const ageBand = escapeSqlString(row.age_band);
      const locale = escapeSqlString(row.locale);
      return `  ('${id}', '${text}', '${category}', '${ageBand}', '${locale}', 1, ${row.created_at})`;
    })
    .join(",\n");

  return [
    header,
    "",
    "INSERT OR IGNORE INTO questions (id, text, category, age_band, locale, approved, created_at) VALUES",
    `${values};`,
    "",
  ].join("\n");
}
