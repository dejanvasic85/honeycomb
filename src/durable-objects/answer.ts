import { z } from "zod";

import type { Player } from "./player";

export const AnswerText = z.string().trim().min(1).max(100);

export interface Answer {
  playerId: string;
  text: string;
  submittedAt: number;
}

export interface AnswerProgress {
  answered: number;
  total: number;
}

// `total` counts connected players only — a disconnected player can't submit
// further, so they shouldn't hold up progress from reaching 100%. A player
// who answered then disconnected still counts toward `answered` if they're
// still connected; if they dropped, they drop out of `total` too.
export function computeAnswerProgress(
  players: Record<string, Player>,
  answers: Record<string, Answer>,
): AnswerProgress {
  const connected = Object.values(players).filter((player) => player.connected);
  const answered = connected.filter((player) => player.id in answers).length;
  return { answered, total: connected.length };
}
