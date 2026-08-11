import { z } from "zod";

export const CreateRoomResponse = z.object({ code: z.string() });

export function roomWsUrl(code: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/room/${code}/ws`;
}

export function playerIdStorageKey(code: string): string {
  return `honeycomb:playerId:${code}`;
}
