export const PHASES = [
  "lobby",
  "question",
  "answering",
  "judging",
  "reveal",
  "scoring",
  "gameover",
] as const;

export type Phase = (typeof PHASES)[number];

// Legal edges from docs/SPEC.md §3. Only `lobby -> question` (host `start`)
// is triggered anywhere yet — the rest are wired up by their own tickets
// (#12 question selection, #14 answering, #15 clustering, #17 scoring).
const PHASE_TRANSITIONS: Record<Phase, readonly Phase[]> = {
  lobby: ["question"],
  question: ["answering"],
  answering: ["judging"],
  judging: ["reveal"],
  reveal: ["scoring"],
  scoring: ["question", "gameover"],
  gameover: [],
};

export function canTransition(from: Phase, to: Phase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}
