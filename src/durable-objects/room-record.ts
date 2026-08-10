import { z } from "zod";

export const InitRoomRequest = z.object({ code: z.string().length(6) });
export type InitRoomRequest = z.infer<typeof InitRoomRequest>;

export interface RoomRecord {
  code: string;
  createdAt: number;
}

export const ROOM_STORAGE_KEY = "room";

// Placeholder cleanup horizon — retention policy is an open question, see
// docs/SPEC.md §9. Registering the alarm now proves the mechanism works;
// `alarm()` deciding what to actually do is deferred.
export const CLEANUP_ALARM_DELAY_MS = 24 * 60 * 60 * 1000;
