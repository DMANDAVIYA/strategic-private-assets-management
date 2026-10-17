import { and, asc, eq, gt, lte, or } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { loginAttempts } from "../db/schema.js";

export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_MAX_FAILURES = 5;

export type LockoutState = { locked: false } | { locked: true; until: number };

type AttemptKeyColumn = typeof loginAttempts.email | typeof loginAttempts.ip;

export function recordAttempt(db: Db, email: string, ip: string, succeeded: boolean, now: number = Date.now()): void {
  db.orm
    .insert(loginAttempts)
    .values({ email, ip, succeeded: succeeded ? 1 : 0, at: now })
    .run();
}

function lockedUntilForKey(db: Db, column: AttemptKeyColumn, value: string, now: number): number | null {
  const failures = db.orm
    .select({ id: loginAttempts.id, at: loginAttempts.at })
    .from(loginAttempts)
    .where(
      and(
        eq(column, value),
        eq(loginAttempts.succeeded, 0),
        gt(loginAttempts.at, now - LOCKOUT_WINDOW_MS),
        lte(loginAttempts.at, now),
      ),
    )
    .orderBy(asc(loginAttempts.at), asc(loginAttempts.id))
    .all();
  const thresholdFailure = failures[LOCKOUT_MAX_FAILURES - 1];
  const latestFailure = failures[failures.length - 1];
  if (thresholdFailure === undefined || latestFailure === undefined) {
    return null;
  }
  const successAfterThreshold = db.orm
    .select({ id: loginAttempts.id })
    .from(loginAttempts)
    .where(
      and(
        eq(column, value),
        eq(loginAttempts.succeeded, 1),
        lte(loginAttempts.at, now),
        or(
          gt(loginAttempts.at, thresholdFailure.at),
          and(eq(loginAttempts.at, thresholdFailure.at), gt(loginAttempts.id, thresholdFailure.id)),
        ),
      ),
    )
    .limit(1)
    .get();
  if (successAfterThreshold !== undefined) {
    return null;
  }
  return latestFailure.at + LOCKOUT_WINDOW_MS;
}

export function lockoutState(db: Db, email: string, ip: string, now: number = Date.now()): LockoutState {
  const untils = [
    lockedUntilForKey(db, loginAttempts.email, email, now),
    lockedUntilForKey(db, loginAttempts.ip, ip, now),
  ].filter((until): until is number => until !== null);
  if (untils.length === 0) {
    return { locked: false };
  }
  return { locked: true, until: Math.max(...untils) };
}
