import { z } from "zod";

import type { Player } from "./player";

export const InitRoomRequest = z.object({ code: z.string().length(6) });
export type InitRoomRequest = z.infer<typeof InitRoomRequest>;

export interface RoomRecord {
  code: string;
  createdAt: number;
  hostId: string | null;
  players: Record<string, Player>;
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
