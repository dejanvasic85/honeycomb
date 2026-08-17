import { describe, expect, it } from "vite-plus/test";

import { earliestAlarmAt, hasAnsweringTimedOut } from "./answering-timer";

describe("hasAnsweringTimedOut", () => {
  it("is false outside the answering phase, even past the deadline", () => {
    expect(hasAnsweringTimedOut("judging", 100, 200)).toBe(false);
  });

  it("is false when no deadline is set", () => {
    expect(hasAnsweringTimedOut("answering", null, 200)).toBe(false);
  });

  it("is false before the deadline", () => {
    expect(hasAnsweringTimedOut("answering", 200, 100)).toBe(false);
  });

  it("is true exactly at the deadline", () => {
    expect(hasAnsweringTimedOut("answering", 200, 200)).toBe(true);
  });

  it("is true after the deadline", () => {
    expect(hasAnsweringTimedOut("answering", 200, 300)).toBe(true);
  });
});

describe("earliestAlarmAt", () => {
  it("returns the candidate when no alarm is currently scheduled", () => {
    expect(earliestAlarmAt(null, 500)).toBe(500);
  });

  it("keeps the current alarm when it is earlier than the candidate", () => {
    expect(earliestAlarmAt(100, 500)).toBe(100);
  });

  it("moves to the candidate when it is earlier than the current alarm", () => {
    expect(earliestAlarmAt(500, 100)).toBe(100);
  });

  it("is stable when the current alarm equals the candidate", () => {
    expect(earliestAlarmAt(500, 500)).toBe(500);
  });
});
