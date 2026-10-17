import { hash as argon2Hash, parseOptions, verify as argon2Verify } from "@node-rs/argon2";

export function hashPassword(pw: string): Promise<string> {
  return argon2Hash(pw);
}

function isWellFormedHash(hash: string): boolean {
  try {
    parseOptions(hash);
    return true;
  } catch {
    return false;
  }
}

export async function verifyPassword(hash: string, pw: string): Promise<boolean> {
  if (!isWellFormedHash(hash)) {
    return false;
  }
  return argon2Verify(hash, pw);
}
