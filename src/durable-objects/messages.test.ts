import { describe, expect, it } from "vite-plus/test";

import { ClientMessage, buildPongMessage } from "./messages";

describe("ClientMessage", () => {
  it("accepts a ping message", () => {
    expect(ClientMessage.safeParse({ type: "ping" }).success).toBe(true);
  });

  it("rejects an unknown type", () => {
    expect(ClientMessage.safeParse({ type: "pong" }).success).toBe(false);
  });

  it("rejects a missing type", () => {
    expect(ClientMessage.safeParse({}).success).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(ClientMessage.safeParse("ping").success).toBe(false);
    expect(ClientMessage.safeParse(null).success).toBe(false);
    expect(ClientMessage.safeParse([]).success).toBe(false);
  });
});

describe("buildPongMessage", () => {
  it("serialises the type and wake count", () => {
    expect(buildPongMessage(3)).toBe(JSON.stringify({ type: "pong", wakeCount: 3 }));
  });
});
