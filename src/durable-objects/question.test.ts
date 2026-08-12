import { describe, expect, it } from "vite-plus/test";

import { pickQuestion } from "./question";
import type { Question } from "./question";

const pool: Question[] = [
  { id: "a", text: "Question A", category: "food" },
  { id: "b", text: "Question B", category: "animals" },
  { id: "c", text: "Question C", category: "silly" },
];

describe("pickQuestion", () => {
  it("returns null for an empty pool", () => {
    expect(pickQuestion([], [])).toBeNull();
  });

  it("excludes already-used ids", () => {
    const picked = pickQuestion(pool, ["a", "c"], () => 0);
    expect(picked?.id).toBe("b");
  });

  it("picks deterministically from the unused set given a fixed random source", () => {
    expect(pickQuestion(pool, [], () => 0)?.id).toBe("a");
    expect(pickQuestion(pool, [], () => 0.999)?.id).toBe("c");
  });

  it("falls back to the full pool once everything has been used", () => {
    const picked = pickQuestion(pool, ["a", "b", "c"], () => 0);
    expect(picked?.id).toBe("a");
  });

  it("never returns a used question while unused ones remain", () => {
    for (let i = 0; i < 20; i++) {
      const picked = pickQuestion(pool, ["a", "b"], () => i / 20);
      expect(picked?.id).toBe("c");
    }
  });
});
