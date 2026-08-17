import type { Phase } from "./phase";

// How long players get to answer before the round is forced along.
// SPEC §9 leaves this open ("fixed, host-configurable, or none?") — picking a
// fixed duration here. 60s is enough to type a 1-3 word answer (SPEC §5)
// without letting one slow/AFK player stall the room.
export const ANSWERING_PHASE_DURATION_MS = 60 * 1000;

export function hasAnsweringTimedOut(
  phase: Phase,
  answeringDeadlineAt: number | null,
  now: number,
): boolean {
  return phase === "answering" && answeringDeadlineAt !== null && now >= answeringDeadlineAt;
}

// A DO has exactly one alarm slot, shared here by the answering timer,
// host-promotion recheck, and room cleanup. Only ever move it earlier, never
// later — otherwise a later caller could silently clobber a sooner pending
// deadline (e.g. a host disconnecting 5s before an answering-phase timeout
// would push the round timeout out by 30s).
export function earliestAlarmAt(current: number | null, candidate: number): number {
  return current === null ? candidate : Math.min(current, candidate);
}
