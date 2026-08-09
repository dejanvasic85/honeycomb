import { generateRoomCode } from "./room-code";

const MAX_ATTEMPTS = 5;

export type InitRoomResult = "created" | "collision";

export async function createRoomWithRetries(
  initRoom: (code: string) => Promise<InitRoomResult>,
  maxAttempts = MAX_ATTEMPTS,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateRoomCode();
    const result = await initRoom(code);
    if (result === "created") return code;
  }

  throw new Error(`Could not allocate a unique room code after ${maxAttempts} attempts`);
}
