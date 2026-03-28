const SESSION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_CODE_LENGTH = 6;

export function normalizeSessionCode(value: string) {
  return value.trim().toUpperCase();
}

export function isValidSessionCode(value: string) {
  const normalized = normalizeSessionCode(value);

  return new RegExp(`^[${SESSION_CODE_ALPHABET}]{${SESSION_CODE_LENGTH}}$`).test(
    normalized,
  );
}

function randomSessionCharacter() {
  const index = Math.floor(Math.random() * SESSION_CODE_ALPHABET.length);
  return SESSION_CODE_ALPHABET[index];
}

export function generateSessionCode(isTaken: (code: string) => boolean) {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const candidate = Array.from({ length: SESSION_CODE_LENGTH }, () =>
      randomSessionCharacter(),
    ).join("");

    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to allocate a unique session code.");
}
