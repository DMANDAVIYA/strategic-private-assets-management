import { Hono } from "hono";
import QRCode from "qrcode";
import type { AuthDeps } from "../auth/deps.js";
import { requireAuth, type AuthEnv } from "../auth/requireAuth.js";
import { getAccessInfo } from "./access.js";

export type SystemDeps = AuthDeps & { port: number; access?: typeof getAccessInfo };

function parseWebUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function systemRoutes(deps: SystemDeps): Hono<AuthEnv> {
  const access = deps.access ?? getAccessInfo;
  const routes = new Hono<AuthEnv>();
  routes.use("*", requireAuth(deps));

  routes.get("/access", async (c) => c.json(await access({ port: deps.port })));

  routes.get("/access/qr.svg", async (c) => {
    const url = parseWebUrl(c.req.query("url") ?? "");
    if (url === null) {
      return c.json({ error: "invalid_url" }, 400);
    }
    const info = await access({ port: deps.port });
    const allowedHosts = new Set<string>();
    for (const lanUrl of info.lanUrls) {
      allowedHosts.add(new URL(lanUrl).hostname);
    }
    if (info.tailscale.hostname !== null) {
      allowedHosts.add(info.tailscale.hostname);
    }
    if (!allowedHosts.has(url.hostname)) {
      return c.json({ error: "invalid_url" }, 400);
    }
    const svg = await QRCode.toString(url.toString(), { type: "svg", margin: 1 });
    return c.body(svg, 200, { "Content-Type": "image/svg+xml" });
  });

  return routes;
}
