import { describe, expect, it, vi } from "vite-plus/test";

import { createRoomWithRetries } from "./create-room";

describe("createRoomWithRetries", () => {
  it("returns the code on the first successful init", async () => {
    const initRoom = vi.fn().mockResolvedValue("created");

    const code = await createRoomWithRetries(initRoom);

    expect(code).toHaveLength(6);
    expect(initRoom).toHaveBeenCalledTimes(1);
  });

  it("retries with a new code after a collision", async () => {
    const initRoom = vi.fn().mockResolvedValueOnce("collision").mockResolvedValueOnce("created");

    const code = await createRoomWithRetries(initRoom);

    expect(initRoom).toHaveBeenCalledTimes(2);
    const [firstAttemptCode, secondAttemptCode] = initRoom.mock.calls.map(([c]) => c);
    expect(code).toBe(secondAttemptCode);
    expect(firstAttemptCode).not.toBe(secondAttemptCode);
  });

  it("throws after exhausting the attempt budget", async () => {
    const initRoom = vi.fn().mockResolvedValue("collision");

    await expect(createRoomWithRetries(initRoom, 3)).rejects.toThrow(
      "Could not allocate a unique room code after 3 attempts",
    );
    expect(initRoom).toHaveBeenCalledTimes(3);
  });
});
