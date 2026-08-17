import { describe, expect, it } from "vite-plus/test";

import { computeEmptiedAt, hasEmptyRoomExpired } from "./room-gc";
import { EMPTY_ROOM_CLEANUP_DELAY_MS } from "./room-record";

describe("computeEmptiedAt", () => {
  it("returns null once anyone is connected", () => {
    expect(computeEmptiedAt(500, true, 1000)).toBeNull();
  });

  it("stamps now the first time the room goes empty", () => {
    expect(computeEmptiedAt(null, false, 1000)).toBe(1000);
  });

  it("keeps the original timestamp across repeated empty checks", () => {
    expect(computeEmptiedAt(500, false, 1000)).toBe(500);
  });

  it("gets a fresh timestamp after refilling and emptying again", () => {
    const refilled = computeEmptiedAt(500, true, 800);
    expect(computeEmptiedAt(refilled, false, 1200)).toBe(1200);
  });
});

describe("hasEmptyRoomExpired", () => {
  it("is false while the room has a connected player", () => {
    expect(hasEmptyRoomExpired(null, 10_000_000)).toBe(false);
  });

  it("is false before the grace period elapses", () => {
    const emptiedAt = 1000;
    expect(hasEmptyRoomExpired(emptiedAt, emptiedAt + EMPTY_ROOM_CLEANUP_DELAY_MS - 1)).toBe(false);
  });

  it("is true exactly at the grace period boundary", () => {
    const emptiedAt = 1000;
    expect(hasEmptyRoomExpired(emptiedAt, emptiedAt + EMPTY_ROOM_CLEANUP_DELAY_MS)).toBe(true);
  });

  it("is true well past the grace period", () => {
    const emptiedAt = 1000;
    expect(hasEmptyRoomExpired(emptiedAt, emptiedAt + EMPTY_ROOM_CLEANUP_DELAY_MS * 10)).toBe(true);
  });
});
