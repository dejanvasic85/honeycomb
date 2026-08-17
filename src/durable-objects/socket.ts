export interface WebSocketAttachment {
  playerId: string;
}

// True when another live socket is already attached to the same player.
// Guards against a stale close/error event (e.g. a refreshed tab's old
// connection finally closing) flipping a player back to disconnected after
// a newer connection already replaced it.
export function hasOtherConnection(
  otherAttachments: readonly (WebSocketAttachment | null)[],
  playerId: string,
): boolean {
  return otherAttachments.some((attachment) => attachment?.playerId === playerId);
}
