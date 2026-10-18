import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { readSessionToken, secondsUntil, writeSessionCookie } from "./auth/cookie.js";
import { currentTime, type AuthDeps } from "./auth/deps.js";
import { resolveSession } from "./auth/requireAuth.js";
import { createSession, revokeSession } from "./auth/sessions.js";
import { users } from "./db/schema.js";
import { clientIp, isLocalClient, userAgentOf } from "./http/request.js";

export type DesktopDeps = AuthDeps & { desktopToken?: string };

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function tokenMatches(expected: string | undefined, provided: string | undefined): boolean {
  if (!expected || provided === undefined) {
    return false;
  }
  return timingSafeEqual(sha256(expected), sha256(provided));
}

export function desktopRoutes(deps: DesktopDeps): Hono {
  const { db } = deps;
  const routes = new Hono();

  routes.get("/enter", (c) => {
    if (!isLocalClient(c) || !tokenMatches(deps.desktopToken, c.req.query("token"))) {
      return c.json({ error: "forbidden" }, 403);
    }
    const owner = db.orm.select({ id: users.id }).from(users).limit(1).get();
    if (owner === undefined) {
      return c.redirect("/setup");
    }
    const existing = resolveSession(c, deps);
    if (existing?.user.id === owner.id && existing.trusted) {
      return c.redirect("/");
    }
    const presentedToken = readSessionToken(c);
    if (presentedToken !== undefined) {
      revokeSession(db, presentedToken);
    }
    const now = currentTime(deps);
    const device = { ip: clientIp(c), userAgent: userAgentOf(c) };
    const { token, expiresAt } = createSession(db, owner.id, { trusted: true, ...device, now });
    writeSessionCookie(c, token, secondsUntil(expiresAt, now));
    return c.redirect("/");
  });

  return routes;
}
