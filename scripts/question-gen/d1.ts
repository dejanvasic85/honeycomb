import { execFileSync } from "node:child_process";

import { z } from "zod";

const D1ExecuteResultSchema = z.array(
  z.object({ results: z.array(z.object({ text: z.string() })) }),
);

// Thin glue over `wrangler d1 execute` — reads the current bank so dedup has
// something to check against. Not unit tested (AGENTS.md: keep runtime glue
// thin, test the pure parts); the pure dedup logic it feeds lives in
// candidate.ts and is tested there.
export function fetchExistingQuestionTexts(opts: { local: boolean } = { local: true }): string[] {
  const args = [
    "wrangler",
    "d1",
    "execute",
    "honeycomb",
    opts.local ? "--local" : "--remote",
    "--json",
    "--command",
    "SELECT text FROM questions",
  ];
  const raw = execFileSync("pnpm", ["exec", ...args], { encoding: "utf8" });
  const parsed: unknown = JSON.parse(raw);

  const result = D1ExecuteResultSchema.safeParse(parsed);
  if (!result.success || result.data.length === 0) return [];

  return result.data[0].results.map((row) => row.text);
}
