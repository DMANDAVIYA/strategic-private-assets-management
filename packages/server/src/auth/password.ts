import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

export function hashPassword(pw: string): Promise<string> {
  return argon2Hash(pw);
}

export async function verifyPassword(hash: string, pw: string): Promise<boolean> {
  try {
    return await argon2Verify(hash, pw);
  } catch {
    return false;
  }
}
