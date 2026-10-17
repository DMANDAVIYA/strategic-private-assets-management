import { createHash, randomBytes } from "node:crypto";
import type { User } from "@financeper/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const TRUSTED_SESSION_TTL_MS = 30 * DAY_MS;
export const UNTRUSTED_SESSION_TTL_MS = DAY_MS;
const TRUSTED_SLIDE_THRESHOLD_MS = 29 * DAY_MS;

export type SessionUser = { user: User; trusted: boolean; expiresAt: number; renewed: boolean };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(
  db: Db,
  userId: number,
  o: { trusted: boolean; ip: string; userAgent: string; now?: number },
): { token: string; expiresAt: number } {
  const now = o.now ?? Date.now();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = now + (o.trusted ? TRUSTED_SESSION_TTL_MS : UNTRUSTED_SESSION_TTL_MS);
  db.orm
    .insert(sessions)
    .values({
      tokenHash: hashToken(token),
      userId,
      trusted: o.trusted ? 1 : 0,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      ip: o.ip,
      userAgent: o.userAgent,
    })
    .run();
  return { token, expiresAt };
}

export function getSessionUser(db: Db, token: string, now: number = Date.now()): SessionUser | null {
  const tokenHash = hashToken(token);
  const row = db.orm
    .select({
      trusted: sessions.trusted,
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
    .get();
  if (row === undefined) {
    return null;
  }
  if (row.expiresAt <= now) {
    db.orm.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).run();
    return null;
  }
  const trusted = row.trusted === 1;
  const renewed = trusted && row.expiresAt - now < TRUSTED_SLIDE_THRESHOLD_MS;
  const expiresAt = renewed ? now + TRUSTED_SESSION_TTL_MS : row.expiresAt;
  db.orm.update(sessions).set({ lastSeenAt: now, expiresAt }).where(eq(sessions.tokenHash, tokenHash)).run();
  return { user: { id: row.id, email: row.email, displayName: row.displayName }, trusted, expiresAt, renewed };
}

export function revokeSession(db: Db, token: string): void {
  db.orm.delete(sessions).where(eq(sessions.tokenHash, hashToken(token))).run();
}
