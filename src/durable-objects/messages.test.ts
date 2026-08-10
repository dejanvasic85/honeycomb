import { describe, expect, it } from "vite-plus/test";

import {
  ClientMessage,
  buildErrorMessage,
  buildJoinedMessage,
  buildPlayerJoinedMessage,
  buildPlayerLeftMessage,
  buildPongMessage,
} from "./messages";
import type { Player } from "./player";

const player: Player = {
  id: "p1",
  name: "Sam",
  connected: true,
  honey: 0,
  stung: false,
  joinedAtRound: 0,
};

describe("ClientMessage", () => {
  it("accepts a ping message", () => {
    expect(ClientMessage.safeParse({ type: "ping" }).success).toBe(true);
  });

  it("accepts a join message and trims the name", () => {
    const result = ClientMessage.safeParse({ type: "join", name: "  Sam  " });
    expect(result.success).toBe(true);
    expect(result.success && result.data.type === "join" && result.data.name).toBe("Sam");
  });

  it("rejects a join message with an empty name", () => {
    expect(ClientMessage.safeParse({ type: "join", name: "   " }).success).toBe(false);
  });

  it("rejects a join message with a name over 20 characters", () => {
    expect(ClientMessage.safeParse({ type: "join", name: "a".repeat(21) }).success).toBe(false);
  });

  it("accepts a rejoin message", () => {
    expect(ClientMessage.safeParse({ type: "rejoin", playerId: "p1" }).success).toBe(true);
  });

  it("rejects a rejoin message missing playerId", () => {
    expect(ClientMessage.safeParse({ type: "rejoin" }).success).toBe(false);
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

describe("buildJoinedMessage", () => {
  it("serialises the type and player", () => {
    expect(buildJoinedMessage(player)).toBe(JSON.stringify({ type: "joined", player }));
  });
});

describe("buildPlayerJoinedMessage", () => {
  it("serialises the type and player", () => {
    expect(buildPlayerJoinedMessage(player)).toBe(JSON.stringify({ type: "playerJoined", player }));
  });
});

describe("buildPlayerLeftMessage", () => {
  it("serialises the type and player", () => {
    expect(buildPlayerLeftMessage(player)).toBe(JSON.stringify({ type: "playerLeft", player }));
  });
});

describe("buildErrorMessage", () => {
  it("serialises the code and message", () => {
    expect(buildErrorMessage("unknown_player", "nope")).toBe(
      JSON.stringify({ type: "error", code: "unknown_player", message: "nope" }),
    );
  });
});
