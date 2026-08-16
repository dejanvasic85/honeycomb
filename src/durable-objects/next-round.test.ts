import { describe, expect, it } from "vite-plus/test";

import { checkNextRound } from "./next-round";

describe("checkNextRound", () => {
  it("allows the host to start the next round from scoring", () => {
    expect(checkNextRound("scoring", "p1", "p1")).toBeNull();
  });

  it("rejects a non-host", () => {
    expect(checkNextRound("scoring", "p1", "p2")).toEqual({
      code: "not_host",
      message: "Only the host can start the next round.",
    });
  });

  it("rejects starting from a phase that isn't scoring", () => {
    expect(checkNextRound("reveal", "p1", "p1")).toEqual({
      code: "invalid_phase",
      message: "There's no round to start yet.",
    });
  });

  it("rejects starting a next round from gameover", () => {
    expect(checkNextRound("gameover", "p1", "p1")).toEqual({
      code: "invalid_phase",
      message: "There's no round to start yet.",
    });
  });
});
