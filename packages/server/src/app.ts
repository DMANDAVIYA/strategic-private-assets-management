import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { authRoutes } from "./auth/routes.js";
import { desktopRoutes } from "./desktop.js";
import { requireSameOriginJson } from "./http/sameOrigin.js";
import { securityHeaders } from "./http/securityHeaders.js";
import { staticSite } from "./http/staticSite.js";
import { systemRoutes, type SystemDeps } from "./system/routes.js";

export type AppDeps = SystemDeps & { staticDir?: string; desktopToken?: string };

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.use("*", securityHeaders);
  app.use("/api/*", requireSameOriginJson);
  app.get("/api/health", (c) => c.json({ ok: true }));
  app.route("/api/auth", authRoutes(deps));
  app.route("/api/system", systemRoutes(deps));
  app.route("/desktop", desktopRoutes(deps));
  if (deps.staticDir) {
    app.route("/", staticSite(deps.staticDir));
  }
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }
    console.error(error);
    return c.json({ error: "internal" }, 500);
  });
  return app;
}
