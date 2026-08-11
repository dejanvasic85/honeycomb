import { describe, expect, it } from "vite-plus/test";

import { canTransition } from "./phase";

describe("canTransition", () => {
  it("allows lobby -> question", () => {
    expect(canTransition("lobby", "question")).toBe(true);
  });

  it("allows the full round trip through to scoring", () => {
    expect(canTransition("question", "answering")).toBe(true);
    expect(canTransition("answering", "judging")).toBe(true);
    expect(canTransition("judging", "reveal")).toBe(true);
    expect(canTransition("reveal", "scoring")).toBe(true);
  });

  it("allows scoring to loop back to question for the next round", () => {
    expect(canTransition("scoring", "question")).toBe(true);
  });

  it("allows scoring -> gameover", () => {
    expect(canTransition("scoring", "gameover")).toBe(true);
  });

  it("rejects skipping phases", () => {
    expect(canTransition("lobby", "reveal")).toBe(false);
    expect(canTransition("lobby", "answering")).toBe(false);
  });

  it("rejects moving backwards", () => {
    expect(canTransition("answering", "question")).toBe(false);
  });

  it("rejects any transition out of gameover", () => {
    expect(canTransition("gameover", "lobby")).toBe(false);
    expect(canTransition("gameover", "question")).toBe(false);
  });

  it("rejects a no-op transition", () => {
    expect(canTransition("lobby", "lobby")).toBe(false);
  });
});
