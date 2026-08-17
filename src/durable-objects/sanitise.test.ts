import { describe, expect, it } from "vite-plus/test";

import type { Answer } from "./answer";
import type { Player } from "./player";
import type { RoomRecord } from "./room-record";
import { sanitiseFor } from "./sanitise";

function makePlayer(overrides: Partial<Player> & Pick<Player, "id">): Player {
  return {
    name: overrides.id,
    connected: true,
    honey: 0,
    stung: false,
    joinedAtRound: 0,
    connectedSince: 0,
    ...overrides,
  };
}

function makeAnswer(overrides: Partial<Answer> & Pick<Answer, "playerId">): Answer {
  return { text: `${overrides.playerId}'s answer`, submittedAt: 0, ...overrides };
}

const threePlayers: Record<string, Player> = {
  p1: makePlayer({ id: "p1" }),
  p2: makePlayer({ id: "p2" }),
  p3: makePlayer({ id: "p3" }),
};

const threeAnswers: Record<string, Answer> = {
  p1: makeAnswer({ playerId: "p1" }),
  p2: makeAnswer({ playerId: "p2" }),
  p3: makeAnswer({ playerId: "p3" }),
};

const answeringRoom: RoomRecord = {
  code: "HX7K2P",
  createdAt: 0,
  hostId: "p1",
  players: threePlayers,
  phase: "answering",
  round: 1,
  currentQuestion: { id: "q1", text: "Name a pizza topping.", category: "food" },
  usedQuestionIds: ["q1"],
  answers: threeAnswers,
  clusters: null,
  answeringDeadlineAt: null,
};

describe("sanitiseFor", () => {
  it("includes only the caller's own answer before reveal", () => {
    const sanitised = sanitiseFor("p1", answeringRoom);
    expect(sanitised.answers).toEqual({ p1: threeAnswers.p1 });
  });

  it("never includes another player's answer text before reveal, across every player", () => {
    for (const playerId of Object.keys(threePlayers)) {
      const sanitised = sanitiseFor(playerId, answeringRoom);
      const otherIds = Object.keys(threeAnswers).filter((id) => id !== playerId);
      for (const otherId of otherIds) {
        expect(sanitised.answers[otherId]).toBeUndefined();
      }
    }
  });

  it("omits the caller's answer entirely if they haven't submitted one", () => {
    const noAnswerYet: RoomRecord = { ...answeringRoom, answers: { p2: threeAnswers.p2 } };
    const sanitised = sanitiseFor("p1", noAnswerYet);
    expect(sanitised.answers).toEqual({});
  });

  it("stays hidden through lobby, question, answering, and judging", () => {
    for (const phase of ["lobby", "question", "answering", "judging"] as const) {
      const room: RoomRecord = { ...answeringRoom, phase };
      expect(sanitiseFor("p2", room).answers).toEqual({ p2: threeAnswers.p2 });
    }
  });

  it("reveals every player's answer from reveal onward", () => {
    for (const phase of ["reveal", "scoring", "gameover"] as const) {
      const room: RoomRecord = { ...answeringRoom, phase };
      expect(sanitiseFor("p1", room).answers).toEqual(threeAnswers);
    }
  });

  it("sanitises a room with no answers to an empty map", () => {
    const empty: RoomRecord = { ...answeringRoom, answers: {} };
    expect(sanitiseFor("p1", empty).answers).toEqual({});
  });

  it("passes through code, hostId, players, phase, round, and currentQuestion unchanged", () => {
    const sanitised = sanitiseFor("p1", answeringRoom);
    expect(sanitised).toMatchObject({
      code: "HX7K2P",
      hostId: "p1",
      players: threePlayers,
      phase: "answering",
      round: 1,
      currentQuestion: { id: "q1", text: "Name a pizza topping.", category: "food" },
    });
  });
});
