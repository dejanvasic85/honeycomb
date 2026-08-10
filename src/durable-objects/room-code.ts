// Uppercase letters and digits, minus ambiguous-looking characters: O/0, I/1, S/5.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ234679";
const ROOM_CODE_LENGTH = 6;

// Largest multiple of the alphabet size that fits in a byte — bytes at or above this
// are rejected so every character keeps a uniform chance of being picked.
const REJECTION_THRESHOLD = 256 - (256 % CODE_ALPHABET.length);

export function generateRoomCode(): string {
  const chars: string[] = [];

  while (chars.length < ROOM_CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
    for (const byte of bytes) {
      if (chars.length >= ROOM_CODE_LENGTH) break;
      if (byte < REJECTION_THRESHOLD) chars.push(CODE_ALPHABET[byte % CODE_ALPHABET.length]);
    }
  }

  return chars.join("");
}

export function normaliseRoomCode(input: string): string {
  return input.trim().toUpperCase();
}
