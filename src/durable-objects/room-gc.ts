import { EMPTY_ROOM_CLEANUP_DELAY_MS } from "./room-record";

// Tracks when a room last had zero connected players. Resets to null the
// moment anyone's connected, so a room that empties, refills, and empties
// again gets a fresh grace period rather than reusing a stale timestamp.
export function computeEmptiedAt(
  previous: number | null,
  anyoneConnected: boolean,
  now: number,
): number | null {
  if (anyoneConnected) return null;
  return previous ?? now;
}

// True once a room has been continuously empty past the GC grace period —
// the point at which alarm() should delete the room rather than re-arm.
export function hasEmptyRoomExpired(emptiedAt: number | null, now: number): boolean {
  return emptiedAt !== null && now - emptiedAt >= EMPTY_ROOM_CLEANUP_DELAY_MS;
}
