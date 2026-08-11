export const MIN_PLAYERS_TO_START = 3;

// null means Start is enabled; otherwise the string is the reason to display.
export function getStartDisabledReason(playerCount: number): string | null {
  if (playerCount >= MIN_PLAYERS_TO_START) return null;

  const needed = MIN_PLAYERS_TO_START - playerCount;
  return `Need ${needed} more player${needed === 1 ? "" : "s"} to start (${playerCount}/${MIN_PLAYERS_TO_START})`;
}
