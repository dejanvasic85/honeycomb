import { z } from "zod";

export const PlayerName = z.string().trim().min(1).max(20);

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  honey: number;
  stung: boolean;
  joinedAtRound: number;
  // Epoch ms of the most recent join/rejoin. Used to find the
  // longest-continuously-connected player for host promotion.
  connectedSince: number;
}

// Appends " (2)", " (3)", ... until the name is free among existingNames.
export function disambiguateName(name: string, existingNames: readonly string[]): string {
  if (!existingNames.includes(name)) return name;

  let suffix = 2;
  while (existingNames.includes(`${name} (${suffix})`)) suffix++;
  return `${name} (${suffix})`;
}
