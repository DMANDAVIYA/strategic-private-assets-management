import { basename, relative, sep } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context, type MiddlewareHandler } from "hono";

const INDEX_FILE = "index.html";
const HASHED_ASSETS_DIR = "assets";

type StaticEnv = { Variables: { servedFile?: string } };

function isApiPath(path: string): boolean {
  return path.startsWith("/api/");
}

function cacheControlFor(root: string, file: string): string | undefined {
  if (basename(file) === INDEX_FILE) {
    return "no-cache";
  }
  if (relative(root, file).split(sep)[0] === HASHED_ASSETS_DIR) {
    return "public, max-age=31536000, immutable";
  }
  return undefined;
}

function outsideApi(handler: MiddlewareHandler<StaticEnv>): MiddlewareHandler<StaticEnv> {
  return (c, next) => (isApiPath(c.req.path) ? next() : handler(c, next));
}

export function staticSite(root: string): Hono<StaticEnv> {
  const site = new Hono<StaticEnv>();
  const rememberServedFile = (file: string, c: Context<StaticEnv>) => {
    c.set("servedFile", file);
  };
  site.use("*", async (c, next) => {
    await next();
    const file = c.get("servedFile");
    const cacheControl = file === undefined ? undefined : cacheControlFor(root, file);
    if (cacheControl !== undefined) {
      c.header("Cache-Control", cacheControl);
    }
  });
  site.get("*", outsideApi(serveStatic({ root, onFound: rememberServedFile })));
  site.get("*", outsideApi(serveStatic({ root, path: INDEX_FILE, onFound: rememberServedFile })));
  return site;
}
