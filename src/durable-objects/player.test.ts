import { describe, expect, it } from "vite-plus/test";

import { PlayerName, disambiguateName } from "./player";

describe("PlayerName", () => {
  it("accepts a plain name", () => {
    expect(PlayerName.safeParse("Sam").success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = PlayerName.safeParse("  Sam  ");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe("Sam");
  });

  it("rejects an empty name after trimming", () => {
    expect(PlayerName.safeParse("   ").success).toBe(false);
  });

  it("rejects names over 20 characters", () => {
    expect(PlayerName.safeParse("a".repeat(21)).success).toBe(false);
  });

  it("accepts a name at exactly 20 characters", () => {
    expect(PlayerName.safeParse("a".repeat(20)).success).toBe(true);
  });
});

describe("disambiguateName", () => {
  it("returns the name unchanged when not taken", () => {
    expect(disambiguateName("Sam", [])).toBe("Sam");
  });

  it("appends (2) when the name is taken once", () => {
    expect(disambiguateName("Sam", ["Sam"])).toBe("Sam (2)");
  });

  it("finds the next free suffix when earlier ones are taken", () => {
    expect(disambiguateName("Sam", ["Sam", "Sam (2)", "Sam (3)"])).toBe("Sam (4)");
  });

  it("does not collide with an unrelated name", () => {
    expect(disambiguateName("Sam", ["Alex"])).toBe("Sam");
  });
});
