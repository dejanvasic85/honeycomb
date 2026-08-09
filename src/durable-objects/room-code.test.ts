import { describe, expect, it } from "vite-plus/test";

import { generateRoomCode, normaliseRoomCode } from "./room-code";

const AMBIGUOUS_CHARS = ["O", "0", "I", "1", "S", "5"];

describe("generateRoomCode", () => {
  it("returns a 6-character uppercase code", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toBe(code.toUpperCase());
  });

  it("never contains ambiguous characters", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      for (const char of AMBIGUOUS_CHARS) {
        expect(code).not.toContain(char);
      }
    }
  });

  it("generates varied codes rather than a fixed value", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("normaliseRoomCode", () => {
  it("uppercases and trims input", () => {
    expect(normaliseRoomCode(" hx7k2p ")).toBe("HX7K2P");
  });

  it("leaves an already-normalised code unchanged", () => {
    expect(normaliseRoomCode("HX7K2P")).toBe("HX7K2P");
  });
});
