import { describe, expect, it } from "vite-plus/test";

import {
  buildQuestionGenerationPrompt,
  dedupeCandidates,
  normaliseQuestionText,
  parseGeneratedQuestions,
  toCandidateRows,
  type QuestionCandidate,
} from "./candidate.ts";

describe("buildQuestionGenerationPrompt", () => {
  it("includes the category, age band, count, and locale", () => {
    const prompt = buildQuestionGenerationPrompt({
      category: "food",
      ageBand: "kids",
      count: 5,
      locale: "en-AU",
    });
    expect(prompt).toContain("food");
    expect(prompt).toContain("kids");
    expect(prompt).toContain("5");
    expect(prompt).toContain("en-AU");
  });

  it("asks for JSON-only output", () => {
    const prompt = buildQuestionGenerationPrompt({
      category: "silly",
      ageBand: "family",
      count: 3,
      locale: "en-AU",
    });
    expect(prompt).toContain('"questions"');
  });
});

describe("parseGeneratedQuestions", () => {
  it("extracts trimmed text from valid JSON", () => {
    const raw = JSON.stringify({ questions: [{ text: "  A topping  " }, { text: "A drink" }] });
    expect(parseGeneratedQuestions(raw)).toEqual(["A topping", "A drink"]);
  });

  it("returns null for invalid JSON", () => {
    expect(parseGeneratedQuestions("not json")).toBeNull();
  });

  it("returns null when the shape doesn't match", () => {
    expect(parseGeneratedQuestions(JSON.stringify({ foo: "bar" }))).toBeNull();
  });

  it("returns null for an empty questions array", () => {
    expect(parseGeneratedQuestions(JSON.stringify({ questions: [] }))).toBeNull();
  });

  it("drops blank entries after trimming", () => {
    const raw = JSON.stringify({ questions: [{ text: "Real one" }, { text: "   " }] });
    expect(parseGeneratedQuestions(raw)).toEqual(["Real one"]);
  });
});

describe("normaliseQuestionText", () => {
  it("lowercases, trims, strips punctuation, and collapses whitespace", () => {
    expect(normaliseQuestionText("  Name a Topping!  You'd  use.  ")).toBe(
      "name a topping youd use",
    );
  });

  it("treats punctuation-only differences as identical", () => {
    expect(normaliseQuestionText("McDonald's")).toBe(normaliseQuestionText("McDonalds"));
  });
});

describe("toCandidateRows", () => {
  it("builds rows with a readable id and approved:false", () => {
    const rows = toCandidateRows(
      ["Name a topping"],
      { category: "food", ageBand: "kids", locale: "en-AU" },
      () => 1000,
    );
    expect(rows).toEqual([
      {
        id: "food-name-a-topping",
        text: "Name a topping",
        category: "food",
        age_band: "kids",
        locale: "en-AU",
        approved: false,
        created_at: 1,
      },
    ]);
  });

  it("disambiguates colliding slugs with a numeric suffix", () => {
    const rows = toCandidateRows(
      ["Name a topping you'd add", "Name a topping you'd remove"],
      { category: "food", ageBand: "kids", locale: "en-AU" },
      () => 0,
    );
    expect(rows[0]?.id).toBe("food-name-a-topping-youd");
    expect(rows[1]?.id).toBe("food-name-a-topping-youd-2");
  });
});

describe("dedupeCandidates", () => {
  const base: QuestionCandidate = {
    id: "food-a",
    text: "Name a topping",
    category: "food",
    age_band: "kids",
    locale: "en-AU",
    approved: false,
    created_at: 0,
  };

  it("drops a candidate matching existing bank text", () => {
    const result = dedupeCandidates([base], ["  Name a TOPPING! "]);
    expect(result).toEqual([]);
  });

  it("drops later duplicates within the same batch", () => {
    const dup: QuestionCandidate = { ...base, id: "food-b", text: "name a topping" };
    const result = dedupeCandidates([base, dup], []);
    expect(result).toEqual([base]);
  });

  it("keeps candidates that don't match anything", () => {
    const result = dedupeCandidates([base], ["Name a drink"]);
    expect(result).toEqual([base]);
  });
});
