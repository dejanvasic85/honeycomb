import { describe, expect, it } from "vite-plus/test";

import {
  ClientMessage,
  ServerMessage,
  buildErrorMessage,
  buildJoinedMessage,
  buildPhaseMessage,
  buildPlayerJoinedMessage,
  buildPlayerLeftMessage,
  buildPongMessage,
  buildQuestionMessage,
  buildStateMessage,
} from "./messages";
import type { Player } from "./player";
import type { RoomRecord } from "./room-record";

const player: Player = {
  id: "p1",
  name: "Sam",
  connected: true,
  honey: 0,
  stung: false,
  joinedAtRound: 0,
  connectedSince: 0,
};

const otherPlayer: Player = {
  id: "p2",
  name: "Alex",
  connected: false,
  honey: 0,
  stung: false,
  joinedAtRound: 0,
  connectedSince: 0,
};

const room: RoomRecord = {
  code: "HX7K2P",
  createdAt: 0,
  hostId: "p1",
  players: { p1: player, p2: otherPlayer },
  phase: "lobby",
  round: 0,
  currentQuestion: null,
  usedQuestionIds: [],
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

  it("accepts a start message", () => {
    expect(ClientMessage.safeParse({ type: "start" }).success).toBe(true);
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

describe("buildStateMessage", () => {
  it("serialises the code, hostId, player roster, phase, round, and question", () => {
    expect(buildStateMessage(room)).toBe(
      JSON.stringify({
        type: "state",
        code: "HX7K2P",
        hostId: "p1",
        players: [player, otherPlayer],
        phase: "lobby",
        round: 0,
        question: null,
      }),
    );
  });

  it("serialises a null hostId", () => {
    const hostless: RoomRecord = { ...room, hostId: null };
    const parsed: unknown = JSON.parse(buildStateMessage(hostless));
    expect(parsed).toMatchObject({ hostId: null });
  });

  it("serialises the current phase and round", () => {
    const inRound: RoomRecord = { ...room, phase: "question", round: 1 };
    const parsed: unknown = JSON.parse(buildStateMessage(inRound));
    expect(parsed).toMatchObject({ phase: "question", round: 1 });
  });

  it("serialises the current question", () => {
    const withQuestion: RoomRecord = {
      ...room,
      currentQuestion: {
        id: "food-pizza-topping",
        text: "Name a pizza topping.",
        category: "food",
      },
    };
    const parsed: unknown = JSON.parse(buildStateMessage(withQuestion));
    expect(parsed).toMatchObject({ question: { text: "Name a pizza topping.", category: "food" } });
  });
});

describe("buildPhaseMessage", () => {
  it("serialises the phase", () => {
    expect(buildPhaseMessage("question")).toBe(
      JSON.stringify({ type: "phase", phase: "question" }),
    );
  });
});

describe("buildQuestionMessage", () => {
  it("serialises the text and category", () => {
    expect(buildQuestionMessage("Name a pizza topping.", "food")).toBe(
      JSON.stringify({ type: "question", text: "Name a pizza topping.", category: "food" }),
    );
  });
});

describe("ServerMessage", () => {
  it("accepts a state message", () => {
    expect(ServerMessage.safeParse(JSON.parse(buildStateMessage(room))).success).toBe(true);
  });

  it("accepts a joined message", () => {
    expect(ServerMessage.safeParse(JSON.parse(buildJoinedMessage(player))).success).toBe(true);
  });

  it("accepts a playerJoined message", () => {
    expect(ServerMessage.safeParse(JSON.parse(buildPlayerJoinedMessage(player))).success).toBe(
      true,
    );
  });

  it("accepts a playerLeft message", () => {
    expect(ServerMessage.safeParse(JSON.parse(buildPlayerLeftMessage(player))).success).toBe(true);
  });

  it("accepts a pong message", () => {
    expect(ServerMessage.safeParse(JSON.parse(buildPongMessage(1))).success).toBe(true);
  });

  it("accepts an error message", () => {
    expect(ServerMessage.safeParse(JSON.parse(buildErrorMessage("code", "msg"))).success).toBe(
      true,
    );
  });

  it("accepts a phase message", () => {
    expect(ServerMessage.safeParse(JSON.parse(buildPhaseMessage("reveal"))).success).toBe(true);
  });

  it("accepts a question message", () => {
    expect(
      ServerMessage.safeParse(JSON.parse(buildQuestionMessage("Name a topping.", "food"))).success,
    ).toBe(true);
  });

  it("rejects an unknown type", () => {
    expect(ServerMessage.safeParse({ type: "nope" }).success).toBe(false);
  });
});
