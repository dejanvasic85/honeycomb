import { z } from "zod";

import type { Answer } from "./answer";
import type { Cluster } from "./cluster";
import type { Phase } from "./phase";
import type { Player } from "./player";
import type { Question } from "./question";

export const InitRoomRequest = z.object({ code: z.string().length(6) });
export type InitRoomRequest = z.infer<typeof InitRoomRequest>;

export interface RoomRecord {
  code: string;
  createdAt: number;
  hostId: string | null;
  players: Record<string, Player>;
  phase: Phase;
  round: number;
  currentQuestion: Question | null;
  usedQuestionIds: string[];
  // Keyed by playerId. NEVER serialise this directly — route every outbound
  // state message through sanitiseFor() (docs/SPEC.md §4).
  answers: Record<string, Answer>;
  // Set once clusterAnswers() runs on entering `judging`; null before then
  // and at the start of every new round.
  clusters: Cluster[] | null;
  // Epoch ms the answering phase forcibly ends, set on entering `answering`
  // and cleared on leaving it. Drives the #18 alarm-based timeout.
  answeringDeadlineAt: number | null;
  // Epoch ms the room last had zero connected players; null while anyone's
  // connected. Drives real empty-room GC (#22) — see room-gc.ts.
  emptiedAt: number | null;
}

export const ROOM_STORAGE_KEY = "room";

// Placeholder cleanup horizon — retention policy is an open question, see
// docs/SPEC.md §9. Registering the alarm now proves the mechanism works;
// `alarm()` deciding what to actually do is deferred.
export const CLEANUP_ALARM_DELAY_MS = 24 * 60 * 60 * 1000;

// Shorter horizon used once a room has no connected players left — proves
// an empty room schedules itself for cleanup sooner than an active one.
// Actual deletion policy is still #22's job.
export const EMPTY_ROOM_CLEANUP_DELAY_MS = 5 * 60 * 1000;
