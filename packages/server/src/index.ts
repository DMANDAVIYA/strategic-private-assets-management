import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import type { Hono } from "hono";
import { createApp } from "./app.js";
import { openDb } from "./db/index.js";

export { createApp, type AppDeps } from "./app.js";
export { getAccessInfo } from "./system/access.js";

export type StartServerOptions = { dbPath: string; host: string; port: number; staticDir?: string; desktopToken?: string };

export type RunningServer = { url: string; close(): Promise<void> };

const UNSPECIFIED_HOSTS = new Set(["0.0.0.0", "::"]);

function urlFor(host: string, port: number): string {
  const reachableHost = UNSPECIFIED_HOSTS.has(host) ? "127.0.0.1" : host;
  return `http://${reachableHost.includes(":") ? `[${reachableHost}]` : reachableHost}:${port}`;
}

function listening(server: Server): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => {
      server.off("error", reject);
      resolve(server.address() as AddressInfo);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

export async function startServer(o: StartServerOptions): Promise<RunningServer> {
  const db = openDb(o.dbPath);
  let app: Hono;
  const server = serve({ fetch: (request, env) => app.fetch(request, env), hostname: o.host, port: o.port }) as Server;
  const address = await listening(server).catch((error: unknown) => {
    db.close();
    throw error;
  });
  app = createApp({ db, port: address.port, staticDir: o.staticDir, desktopToken: o.desktopToken });
  return {
    url: urlFor(o.host, address.port),
    close: async () => {
      try {
        await closeServer(server);
      } finally {
        db.close();
      }
    },
  };
}
