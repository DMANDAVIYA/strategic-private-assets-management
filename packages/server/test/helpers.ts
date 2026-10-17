import { Hono } from "hono";
import { authRoutes } from "../src/auth/routes.js";
import { getAccessInfo } from "../src/system/access.js";
import { systemRoutes } from "../src/system/routes.js";
import { openDb, type Db } from "../src/db/index.js";

export const testUser = { email: "a@b.co", password: "correct horse battery", displayName: "Alex" };

export type RequestOptions = {
  headers?: Record<string, string>;
  cookie?: string;
  remoteAddress?: string;
  url?: string;
};

export function makeTestApp(options: { now?: () => number; access?: typeof getAccessInfo } = {}): { app: Hono; db: Db } {
  const db = openDb(":memory:");
  const app = new Hono();
  app.route("/api/auth", authRoutes({ db, now: options.now }));
  app.route("/api/system", systemRoutes({ db, now: options.now, port: 7777, access: options.access }));
  return { app, db };
}

export function cookieFrom(res: Response): string {
  const match = /fp_session=[^;]*/.exec(res.headers.get("set-cookie") ?? "");
  if (!match) {
    throw new Error("response did not set fp_session");
  }
  return match[0];
}

export function send(app: Hono, method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const init: RequestInit = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
  const env = options.remoteAddress ? { incoming: { socket: { remoteAddress: options.remoteAddress } } } : undefined;
  return Promise.resolve(app.request(options.url ?? path, init, env));
}

export function get(app: Hono, path: string, options: RequestOptions = {}): Promise<Response> {
  return send(app, "GET", path, undefined, options);
}

export function post(app: Hono, path: string, body?: unknown, options: RequestOptions = {}): Promise<Response> {
  return send(app, "POST", path, body, options);
}

export function login(
  app: Hono,
  body: { email: string; password: string; trustDevice?: boolean },
  options: RequestOptions = {},
): Promise<Response> {
  return post(app, "/api/auth/login", body, options);
}

export async function setupUser(app: Hono, user: typeof testUser = testUser): Promise<string> {
  const res = await post(app, "/api/auth/setup", user);
  if (res.status !== 201) {
    throw new Error(`setup failed with status ${res.status}`);
  }
  return cookieFrom(res);
}

export function countRows(db: Db, table: string, where = "1 = 1"): number {
  const row = db.sqlite.prepare(`select count(*) as n from ${table} where ${where}`).get() as { n: number };
  return row.n;
}
