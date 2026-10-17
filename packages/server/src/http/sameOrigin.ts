import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isJsonContentType(contentType: string | undefined): boolean {
  return contentType?.split(";")[0]?.trim().toLowerCase() === "application/json";
}

function hostOfOrigin(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

function requestHost(c: Context): string {
  return (c.req.header("host") ?? new URL(c.req.url).host).toLowerCase();
}

export const requireSameOriginJson = createMiddleware(async (c, next) => {
  if (!WRITE_METHODS.has(c.req.method)) {
    return next();
  }
  const origin = c.req.header("origin");
  if (origin !== undefined && hostOfOrigin(origin) !== requestHost(c)) {
    return c.json({ error: "bad_origin" }, 403);
  }
  if (!isJsonContentType(c.req.header("content-type"))) {
    return c.json({ error: "unsupported_media_type" }, 415);
  }
  await next();
});
