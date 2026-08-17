import { describe, expect, it } from "vite-plus/test";

import { buildInsertMigrationSql, selectApproved } from "./migration.ts";
import type { QuestionCandidate } from "./candidate.ts";

describe("selectApproved", () => {
  it("keeps only approved:true rows and drops the approved field", () => {
    const candidates: QuestionCandidate[] = [
      {
        id: "food-a",
        text: "Name a topping",
        category: "food",
        age_band: "kids",
        locale: "en-AU",
        approved: true,
        created_at: 1,
      },
      {
        id: "food-b",
        text: "Name a drink",
        category: "food",
        age_band: "kids",
        locale: "en-AU",
        approved: false,
        created_at: 2,
      },
    ];
    expect(selectApproved(candidates)).toEqual([
      {
        id: "food-a",
        text: "Name a topping",
        category: "food",
        age_band: "kids",
        locale: "en-AU",
        created_at: 1,
      },
    ]);
  });
});

describe("buildInsertMigrationSql", () => {
  it("emits an INSERT OR IGNORE statement with approved = 1", () => {
    const sql = buildInsertMigrationSql(
      [
        {
          id: "food-a",
          text: "Name a topping",
          category: "food",
          age_band: "kids",
          locale: "en-AU",
          created_at: 100,
        },
      ],
      "0003",
      "2026-08-17T00:00:00.000Z",
    );
    expect(sql).toContain("-- Migration number: 0003");
    expect(sql).toContain("INSERT OR IGNORE INTO questions");
    expect(sql).toContain("('food-a', 'Name a topping', 'food', 'kids', 'en-AU', 1, 100)");
  });

  it("escapes single quotes in text", () => {
    const sql = buildInsertMigrationSql(
      [
        {
          id: "silly-mcdonalds",
          text: "Name a place you'd never go",
          category: "silly",
          age_band: "family",
          locale: "en-AU",
          created_at: 5,
        },
      ],
      "0003",
      "2026-08-17T00:00:00.000Z",
    );
    expect(sql).toContain("Name a place you''d never go");
  });

  it("produces a no-op file with no rows", () => {
    const sql = buildInsertMigrationSql([], "0003", "2026-08-17T00:00:00.000Z");
    expect(sql).not.toContain("INSERT");
    expect(sql).toContain("-- Migration number: 0003");
  });
});
