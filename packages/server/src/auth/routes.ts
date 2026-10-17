import { randomBytes } from "node:crypto";
import { LoginInput, SetupInput, type AuthStatus, type User } from "@financeper/shared";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import type { Db } from "../db/index.js";
import { users } from "../db/schema.js";
import { clientIp } from "../http/request.js";
import { seedDefaults } from "../settings.js";
import { clearSessionCookie, readSessionToken, secondsUntil, writeSessionCookie } from "./cookie.js";
import { currentTime, type AuthDeps } from "./deps.js";
import { lockoutState, recordAttempt } from "./lockout.js";
import { hashPassword, verifyPassword } from "./password.js";
import { requireAuth, resolveSession } from "./requireAuth.js";
import { createSession, revokeSession } from "./sessions.js";

type SessionGrant = { user: User; token: string; maxAgeSeconds: number };

type LoginOutcome =
  | { kind: "locked"; until: number }
  | { kind: "invalid_credentials" }
  | ({ kind: "signed_in" } & SessionGrant);

async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

function userExists(db: Db): boolean {
  return db.orm.select({ id: users.id }).from(users).limit(1).get() !== undefined;
}

function userAgentOf(c: Context): string {
  return c.req.header("user-agent") ?? "";
}

function createExclusiveRunner(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
}

export function authRoutes(deps: AuthDeps): Hono {
  const { db } = deps;
  const app = new Hono();
  const runLoginExclusively = createExclusiveRunner();
  let unknownUserHash: Promise<string> | undefined;
  const hashForUnknownUser = () => (unknownUserHash ??= hashPassword(randomBytes(32).toString("base64url")));

  function createFirstUser(
    input: SetupInput,
    passwordHash: string,
    device: { ip: string; userAgent: string },
    now: number,
  ): SessionGrant | null {
    return db.sqlite
      .transaction(() => {
        if (userExists(db)) {
          return null;
        }
        const user: User = db.orm
          .insert(users)
          .values({ email: input.email, displayName: input.displayName, passwordHash, createdAt: now })
          .returning({ id: users.id, email: users.email, displayName: users.displayName })
          .get();
        seedDefaults(db);
        const { token, expiresAt } = createSession(db, user.id, { trusted: false, ...device, now });
        return { user, token, maxAgeSeconds: secondsUntil(expiresAt, now) };
      })
      .immediate();
  }

  async function attemptLogin(input: LoginInput, device: { ip: string; userAgent: string }): Promise<LoginOutcome> {
    const now = currentTime(deps);
    const lock = lockoutState(db, input.email, device.ip, now);
    if (lock.locked) {
      recordAttempt(db, input.email, device.ip, false, now);
      return { kind: "locked", until: lock.until };
    }
    const account = db.orm.select().from(users).where(eq(users.email, input.email)).get();
    const passwordMatches = await verifyPassword(account?.passwordHash ?? (await hashForUnknownUser()), input.password);
    if (account === undefined || !passwordMatches) {
      recordAttempt(db, input.email, device.ip, false, now);
      return { kind: "invalid_credentials" };
    }
    recordAttempt(db, input.email, device.ip, true, now);
    const { token, expiresAt } = createSession(db, account.id, { trusted: input.trustDevice, ...device, now });
    const user: User = { id: account.id, email: account.email, displayName: account.displayName };
    return { kind: "signed_in", user, token, maxAgeSeconds: secondsUntil(expiresAt, now) };
  }

  app.get("/status", (c) => {
    const session = resolveSession(c, deps);
    const status: AuthStatus = {
      setupRequired: !userExists(db),
      authenticated: session !== null,
      user: session?.user ?? null,
    };
    return c.json(status, 200);
  });

  app.post("/setup", async (c) => {
    if (userExists(db)) {
      return c.json({ error: "already_set_up" }, 409);
    }
    const parsed = SetupInput.safeParse(await readJsonBody(c));
    if (!parsed.success) {
      return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const now = currentTime(deps);
    const grant = createFirstUser(parsed.data, passwordHash, { ip: clientIp(c), userAgent: userAgentOf(c) }, now);
    if (grant === null) {
      return c.json({ error: "already_set_up" }, 409);
    }
    writeSessionCookie(c, grant.token, grant.maxAgeSeconds);
    return c.json({ user: grant.user }, 201);
  });

  app.post("/login", async (c) => {
    const parsed = LoginInput.safeParse(await readJsonBody(c));
    if (!parsed.success) {
      return c.json({ error: "invalid", issues: parsed.error.issues }, 400);
    }
    const device = { ip: clientIp(c), userAgent: userAgentOf(c) };
    const outcome = await runLoginExclusively(() => attemptLogin(parsed.data, device));
    if (outcome.kind === "locked") {
      return c.json({ error: "locked", until: outcome.until }, 423);
    }
    if (outcome.kind === "invalid_credentials") {
      return c.json({ error: "invalid_credentials" }, 401);
    }
    writeSessionCookie(c, outcome.token, outcome.maxAgeSeconds);
    return c.json({ user: outcome.user }, 200);
  });

  app.post("/logout", (c) => {
    const token = readSessionToken(c);
    if (token !== undefined) {
      revokeSession(db, token);
    }
    clearSessionCookie(c);
    return c.body(null, 204);
  });

  app.get("/me", requireAuth(deps), (c) => c.json({ user: c.get("user") }, 200));

  return app;
}
