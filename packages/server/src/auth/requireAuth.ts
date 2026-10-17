import type { User } from "@financeper/shared";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { readSessionToken, secondsUntil, writeSessionCookie } from "./cookie.js";
import { currentTime, type AuthDeps } from "./deps.js";
import { getSessionUser, type SessionUser } from "./sessions.js";

export type AuthEnv = { Variables: { user: User } };

export function resolveSession(c: Context, deps: AuthDeps): SessionUser | null {
  const token = readSessionToken(c);
  if (token === undefined) {
    return null;
  }
  const now = currentTime(deps);
  const session = getSessionUser(deps.db, token, now);
  if (session?.renewed) {
    writeSessionCookie(c, token, secondsUntil(session.expiresAt, now));
  }
  return session;
}

export function requireAuth(deps: AuthDeps): MiddlewareHandler<AuthEnv> {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const session = resolveSession(c, deps);
    if (session === null) {
      return c.json({ error: "unauthenticated" }, 401);
    }
    c.set("user", session.user);
    await next();
  });
}
