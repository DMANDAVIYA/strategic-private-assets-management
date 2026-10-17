import { createHash } from "node:crypto";
import { createSession, getSessionUser, revokeSession } from "../src/auth/sessions.js";
import { openDb, type Db } from "../src/db/index.js";

const T0 = Date.UTC(2026, 9, 17, 12);
const DAY = 24 * 60 * 60 * 1000;
const device = { ip: "192.168.1.20", userAgent: "vitest" };

type SessionRow = {
  token_hash: string;
  user_id: number;
  trusted: number;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  ip: string;
  user_agent: string;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function dbWithUser(): { db: Db; userId: number } {
  const db = openDb(":memory:");
  const result = db.sqlite
    .prepare("insert into users (email, display_name, password_hash, created_at) values (?, ?, ?, ?)")
    .run("a@b.co", "Alex", "hash", T0);
  return { db, userId: Number(result.lastInsertRowid) };
}

function sessionRow(db: Db, token: string): SessionRow | undefined {
  return db.sqlite.prepare("select * from sessions where token_hash = ?").get(sha256Hex(token)) as SessionRow | undefined;
}

test("expired session returns null and is deleted", () => {
  const { db, userId } = dbWithUser();
  const { token, expiresAt } = createSession(db, userId, { trusted: false, ...device, now: T0 });
  expect(expiresAt).toBe(T0 + DAY);
  expect(getSessionUser(db, token, expiresAt)).toBeNull();
  expect(sessionRow(db, token)).toBeUndefined();
  db.close();
});

test("expired trusted session returns null and is deleted", () => {
  const { db, userId } = dbWithUser();
  const { token, expiresAt } = createSession(db, userId, { trusted: true, ...device, now: T0 });
  expect(expiresAt).toBe(T0 + 30 * DAY);
  expect(getSessionUser(db, token, expiresAt + 1)).toBeNull();
  expect(sessionRow(db, token)).toBeUndefined();
  db.close();
});

test("trusted session slides forward when used", () => {
  const { db, userId } = dbWithUser();
  const { token } = createSession(db, userId, { trusted: true, ...device, now: T0 });
  expect(getSessionUser(db, token, T0 + DAY / 2)).toEqual({
    user: { id: userId, email: "a@b.co", displayName: "Alex" },
    trusted: true,
    expiresAt: T0 + 30 * DAY,
    renewed: false,
  });
  expect(sessionRow(db, token)).toMatchObject({ expires_at: T0 + 30 * DAY, last_seen_at: T0 + DAY / 2 });
  expect(getSessionUser(db, token, T0 + 2 * DAY)).toMatchObject({ expiresAt: T0 + 32 * DAY, renewed: true });
  expect(sessionRow(db, token)).toMatchObject({ expires_at: T0 + 32 * DAY, last_seen_at: T0 + 2 * DAY });
  expect(getSessionUser(db, token, T0 + 31 * DAY)).toMatchObject({ expiresAt: T0 + 61 * DAY, renewed: true });
  expect(sessionRow(db, token)).toMatchObject({ expires_at: T0 + 61 * DAY, last_seen_at: T0 + 31 * DAY });
  db.close();
});

test("untrusted session keeps its expiry and records last seen", () => {
  const { db, userId } = dbWithUser();
  const { token } = createSession(db, userId, { trusted: false, ...device, now: T0 });
  expect(getSessionUser(db, token, T0 + DAY - 1)).toEqual({
    user: { id: userId, email: "a@b.co", displayName: "Alex" },
    trusted: false,
    expiresAt: T0 + DAY,
    renewed: false,
  });
  expect(sessionRow(db, token)).toMatchObject({ expires_at: T0 + DAY, last_seen_at: T0 + DAY - 1 });
  db.close();
});

test("tokens are random base64url and stored only as sha256 hex", () => {
  const { db, userId } = dbWithUser();
  const first = createSession(db, userId, { trusted: true, ...device, now: T0 });
  const second = createSession(db, userId, { trusted: false, ...device, now: T0 });
  expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(first.token).not.toBe(second.token);
  const row = sessionRow(db, first.token);
  expect(row).toEqual({
    token_hash: sha256Hex(first.token),
    user_id: userId,
    trusted: 1,
    created_at: T0,
    last_seen_at: T0,
    expires_at: T0 + 30 * DAY,
    ip: device.ip,
    user_agent: device.userAgent,
  });
  expect(JSON.stringify(db.sqlite.prepare("select * from sessions").all())).not.toContain(first.token);
  db.close();
});

test("revoked session no longer resolves", () => {
  const { db, userId } = dbWithUser();
  const { token } = createSession(db, userId, { trusted: true, ...device, now: T0 });
  const other = createSession(db, userId, { trusted: true, ...device, now: T0 });
  revokeSession(db, token);
  expect(getSessionUser(db, token, T0 + 1)).toBeNull();
  expect(getSessionUser(db, other.token, T0 + 1)).not.toBeNull();
  db.close();
});

test("unknown token returns null", () => {
  const { db } = dbWithUser();
  expect(getSessionUser(db, "unknown", T0)).toBeNull();
  db.close();
});
