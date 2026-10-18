import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HTTPException } from "hono/http-exception";
import { get, login, makeTestApp, post, send, setupUser, testUser } from "./helpers.js";

const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'",
};

function expectSecurityHeaders(res: Response): void {
  for (const [name, value] of Object.entries(securityHeaders)) {
    expect(res.headers.get(name)).toBe(value);
  }
}

const indexHtml = "<!doctype html><title>financeper</title>";
const assetJs = "export const answer = 42;";
let staticDir: string;

beforeAll(() => {
  staticDir = mkdtempSync(join(tmpdir(), "fp-static-"));
  writeFileSync(join(staticDir, "index.html"), indexHtml);
  writeFileSync(join(staticDir, "manifest.webmanifest"), "{}");
  mkdirSync(join(staticDir, "assets"));
  writeFileSync(join(staticDir, "assets", "a.js"), assetJs);
});

afterAll(() => {
  rmSync(staticDir, { recursive: true, force: true });
});

test("health returns ok with the security headers", async () => {
  const { app } = makeTestApp();
  const res = await get(app, "/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expectSecurityHeaders(res);
});

test("unknown api path returns 404 json with the security headers", async () => {
  const { app } = makeTestApp();
  const res = await get(app, "/api/x");
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "not_found" });
  expectSecurityHeaders(res);
});

test("unknown api path stays 404 json when a static dir is served", async () => {
  const { app } = makeTestApp({ staticDir });
  const res = await get(app, "/api/x");
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "not_found" });
  const write = await post(app, "/api/x", {});
  expect(write.status).toBe(404);
  expect(await write.json()).toEqual({ error: "not_found" });
});

test("static dir serves hashed assets as immutable files", async () => {
  const { app } = makeTestApp({ staticDir });
  const res = await get(app, "/assets/a.js");
  expect(res.status).toBe(200);
  expect(await res.text()).toBe(assetJs);
  expect(res.headers.get("content-type")).toContain("javascript");
  expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  expectSecurityHeaders(res);
});

test("static dir serves other files without a cache policy", async () => {
  const { app } = makeTestApp({ staticDir });
  const res = await get(app, "/manifest.webmanifest");
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("{}");
  expect(res.headers.get("cache-control")).toBeNull();
});

test.each(["/", "/index.html", "/settings/access", "/assets/missing.js"])("GET %s serves index.html with no-cache", async (path) => {
  const { app } = makeTestApp({ staticDir });
  const res = await get(app, path);
  expect(res.status).toBe(200);
  expect(await res.text()).toBe(indexHtml);
  expect(res.headers.get("content-type")).toContain("text/html");
  expect(res.headers.get("cache-control")).toBe("no-cache");
  expectSecurityHeaders(res);
});

test("non-GET requests outside the api do not fall back to index.html", async () => {
  const { app } = makeTestApp({ staticDir });
  const res = await post(app, "/settings/access", {});
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "not_found" });
});

test("without a static dir non-api paths return 404 json", async () => {
  const { app } = makeTestApp();
  const res = await get(app, "/settings/access");
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "not_found" });
});

test.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"])(
  "a %s POST to /api/auth/login is rejected with 415",
  async (contentType) => {
    const { app, db } = makeTestApp();
    await setupUser(app);
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": contentType },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "unsupported_media_type" });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(db.sqlite.prepare("select count(*) as n from login_attempts").get()).toEqual({ n: 0 });
  },
);

test("a POST without a content type is rejected with 415", async () => {
  const { app } = makeTestApp();
  const res = await app.request("/api/auth/logout", { method: "POST" });
  expect(res.status).toBe(415);
  expect(await res.json()).toEqual({ error: "unsupported_media_type" });
});

test.each(["PUT", "PATCH", "DELETE"])("%s under /api requires json too", async (method) => {
  const { app } = makeTestApp();
  const res = await app.request("/api/x", { method, headers: { "content-type": "text/plain" }, body: "x" });
  expect(res.status).toBe(415);
  expect(await res.json()).toEqual({ error: "unsupported_media_type" });
});

test("json with parameters is accepted", async () => {
  const { app } = makeTestApp();
  await setupUser(app);
  const res = await login(app, { email: testUser.email, password: testUser.password }, {
    headers: { "content-type": "Application/JSON; charset=utf-8" },
  });
  expect(res.status).toBe(200);
});

test.each(["https://evil.example", "http://localhost.evil.example", "null"])("a json POST with Origin %s is rejected with 403", async (origin) => {
  const { app } = makeTestApp();
  await setupUser(app);
  const res = await login(app, { email: testUser.email, password: testUser.password }, { headers: { origin } });
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: "bad_origin" });
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("a json POST whose Origin matches the Host header passes through", async () => {
  const { app } = makeTestApp();
  const res = await post(app, "/api/auth/setup", testUser, {
    url: "http://192.168.1.20:7777/api/auth/setup",
    headers: { host: "192.168.1.20:7777", origin: "http://192.168.1.20:7777" },
  });
  expect(res.status).toBe(201);
});

test("the Host header, not the request url, decides the origin match", async () => {
  const { app } = makeTestApp();
  const res = await post(app, "/api/auth/setup", testUser, {
    url: "http://evil.example/api/auth/setup",
    headers: { host: "192.168.1.20:7777", origin: "http://evil.example" },
  });
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({ error: "bad_origin" });
});

test("a json POST with a matching Origin and no Host header falls back to the url host", async () => {
  const { app } = makeTestApp();
  const res = await post(app, "/api/auth/setup", testUser, { headers: { origin: "http://localhost" } });
  expect(res.status).toBe(201);
});

test("GET requests are unaffected by Origin and content type checks", async () => {
  const { app } = makeTestApp();
  const res = await send(app, "GET", "/api/auth/status", undefined, {
    headers: { origin: "https://evil.example", "content-type": "text/plain" },
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ setupRequired: true });
});

test("unexpected errors become a 500 json with the security headers", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const { app } = makeTestApp();
    app.get("/api/boom", () => {
      throw new Error("boom");
    });
    const res = await get(app, "/api/boom");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal" });
    expectSecurityHeaders(res);
    expect(errors).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
  } finally {
    errors.mockRestore();
  }
});

test("http exceptions keep their own status", async () => {
  const { app } = makeTestApp();
  app.get("/api/teapot", () => {
    throw new HTTPException(418, { message: "short and stout" });
  });
  const res = await get(app, "/api/teapot");
  expect(res.status).toBe(418);
  expect(await res.text()).toBe("short and stout");
  expectSecurityHeaders(res);
});
