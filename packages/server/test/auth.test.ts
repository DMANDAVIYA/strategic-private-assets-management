import { verifyPassword } from "../src/auth/password.js";
import { requireAuth } from "../src/auth/requireAuth.js";
import { getSetting } from "../src/settings.js";
import { cookieFrom, countRows, get, login, makeTestApp, post, setupUser, testUser } from "./helpers.js";

const T0 = Date.UTC(2026, 9, 17, 12);
const DAY = 24 * 60 * 60 * 1000;
const expectedUser = { id: expect.any(Number), email: "a@b.co", displayName: "Alex" };
const correct = { email: testUser.email, password: testUser.password };

test("status before setup: setupRequired true", async () => {
  const { app } = makeTestApp();
  const res = await get(app, "/api/auth/status");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ setupRequired: true, authenticated: false, user: null });
});

test("status after setup reports the user only with a valid cookie", async () => {
  const { app } = makeTestApp();
  const cookie = await setupUser(app);
  const anonymous = await get(app, "/api/auth/status");
  expect(anonymous.status).toBe(200);
  expect(await anonymous.json()).toEqual({ setupRequired: false, authenticated: false, user: null });
  const signedIn = await get(app, "/api/auth/status", { cookie });
  expect(signedIn.status).toBe(200);
  expect(await signedIn.json()).toEqual({ setupRequired: false, authenticated: true, user: expectedUser });
});

test("setup creates the user, seeds defaults, sets cookie", async () => {
  const { app, db } = makeTestApp();
  const res = await post(app, "/api/auth/setup", testUser);
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ user: expectedUser });
  const header = res.headers.get("set-cookie") ?? "";
  expect(header).toMatch(/^fp_session=[A-Za-z0-9_-]{43};/);
  expect(header).toContain("HttpOnly");
  expect(header).toContain("SameSite=Lax");
  expect(header).toContain("Path=/");
  expect(header).toContain("Max-Age=86400");
  expect(header).not.toContain("Secure");
  expect(db.sqlite.prepare("select trusted from sessions").all()).toEqual([{ trusted: 0 }]);
  expect(getSetting(db, "displayCurrency")).toBe("USD");
  expect(getSetting(db, "timezone")).toBe("America/New_York");
});

test("setup stores the password as an argon2id hash", async () => {
  const { app, db } = makeTestApp();
  await setupUser(app);
  const { hash } = db.sqlite.prepare("select password_hash as hash from users").get() as { hash: string };
  expect(hash).toMatch(/^\$argon2id\$/);
  expect(hash).not.toContain(testUser.password);
  expect(await verifyPassword(hash, testUser.password)).toBe(true);
  expect(await verifyPassword(hash, "wrong password")).toBe(false);
  expect(await verifyPassword("not-a-hash", testUser.password)).toBe(false);
});

test("second setup returns 409 even with a different email", async () => {
  const { app, db } = makeTestApp();
  await setupUser(app);
  const res = await post(app, "/api/auth/setup", { ...testUser, email: "other@b.co" });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "already_set_up" });
  expect(res.headers.get("set-cookie")).toBeNull();
  expect(countRows(db, "users")).toBe(1);
});

test("concurrent setups create exactly one user", async () => {
  const { app, db } = makeTestApp();
  const responses = await Promise.all([
    post(app, "/api/auth/setup", testUser),
    post(app, "/api/auth/setup", { ...testUser, email: "other@b.co" }),
  ]);
  expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
  expect(countRows(db, "users")).toBe(1);
  expect(countRows(db, "sessions")).toBe(1);
});

test("setup with an invalid body returns 400 with issues", async () => {
  const { app, db } = makeTestApp();
  const res = await post(app, "/api/auth/setup", { email: "not-an-email", password: "short", displayName: " " });
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error: string; issues: { path: string[] }[] };
  expect(body.error).toBe("invalid");
  expect(body.issues.map((issue) => issue.path[0]).sort()).toEqual(["displayName", "email", "password"]);
  expect(countRows(db, "users")).toBe(0);
});

test("malformed json returns 400 invalid", async () => {
  const { app } = makeTestApp();
  const res = await app.request("/api/auth/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ error: "invalid", issues: expect.any(Array) });
});

test("login with wrong password → 401 and no cookie", async () => {
  const { app } = makeTestApp();
  await setupUser(app);
  const res = await login(app, { email: testUser.email, password: "wrong password" });
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: "invalid_credentials" });
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("login with an unknown email → 401 and no cookie", async () => {
  const { app } = makeTestApp();
  await setupUser(app);
  const res = await login(app, { email: "nobody@b.co", password: testUser.password });
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ error: "invalid_credentials" });
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("login with an invalid body returns 400", async () => {
  const { app } = makeTestApp();
  await setupUser(app);
  const res = await login(app, { email: "not-an-email", password: "" });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ error: "invalid", issues: expect.any(Array) });
});

test("login is case-insensitive on email", async () => {
  const { app } = makeTestApp();
  await setupUser(app);
  const res = await login(app, { email: "A@B.CO", password: testUser.password });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ user: expectedUser });
  expect(cookieFrom(res)).toMatch(/^fp_session=[A-Za-z0-9_-]{43}$/);
});

test("login with x-forwarded-proto https sets Secure cookie", async () => {
  const { app } = makeTestApp();
  await setupUser(app);
  const forwarded = await login(app, correct, { headers: { "x-forwarded-proto": "https" }, remoteAddress: "127.0.0.1" });
  expect(forwarded.status).toBe(200);
  const forwardedHeader = forwarded.headers.get("set-cookie") ?? "";
  expect(forwardedHeader).toContain("Secure");
  expect(forwardedHeader).toContain("HttpOnly");
  expect(forwardedHeader).toContain("SameSite=Lax");
  const direct = await login(app, correct, { url: "https://localhost/api/auth/login" });
  expect(direct.status).toBe(200);
  expect(direct.headers.get("set-cookie")).toContain("Secure");
});

test("login over plain http does not set Secure", async () => {
  const { app } = makeTestApp();
  await setupUser(app);
  const res = await login(app, correct, { headers: { "x-forwarded-proto": "http" }, remoteAddress: "127.0.0.1" });
  expect(res.status).toBe(200);
  const header = res.headers.get("set-cookie") ?? "";
  expect(header).toContain("fp_session=");
  expect(header).not.toContain("Secure");
});

test("x-forwarded-proto https from a lan address does not set Secure", async () => {
  const { app } = makeTestApp();
  await setupUser(app);
  const res = await login(app, correct, { headers: { "x-forwarded-proto": "https" }, remoteAddress: "192.168.1.9" });
  expect(res.status).toBe(200);
  const header = res.headers.get("set-cookie") ?? "";
  expect(header).toContain("fp_session=");
  expect(header).not.toContain("Secure");
});

test("trusted session cookie is re-issued when the session slides", async () => {
  const clock = { now: T0 };
  const { app } = makeTestApp({ now: () => clock.now });
  await setupUser(app);
  const cookie = cookieFrom(await login(app, { ...correct, trustDevice: true }));
  clock.now = T0 + DAY / 2;
  const early = await get(app, "/api/auth/me", { cookie });
  expect(early.status).toBe(200);
  expect(early.headers.get("set-cookie")).toBeNull();
  clock.now = T0 + 2 * DAY;
  const slid = await get(app, "/api/auth/me", { cookie });
  expect(slid.status).toBe(200);
  const header = slid.headers.get("set-cookie") ?? "";
  expect(header.startsWith(`${cookie};`)).toBe(true);
  expect(header).toContain("Max-Age=2592000");
  expect(header).toContain("HttpOnly");
  expect(header).toContain("SameSite=Lax");
  expect(header).toContain("Path=/");
  expect(header).not.toContain("Secure");
  clock.now = T0 + 4 * DAY;
  const status = await get(app, "/api/auth/status", { cookie, headers: { "x-forwarded-proto": "https" }, remoteAddress: "127.0.0.1" });
  expect(await status.json()).toMatchObject({ authenticated: true });
  const statusHeader = status.headers.get("set-cookie") ?? "";
  expect(statusHeader.startsWith(`${cookie};`)).toBe(true);
  expect(statusHeader).toContain("Max-Age=2592000");
  expect(statusHeader).toContain("Secure");
});

test("requireAuth re-issues the slid cookie on any protected route", async () => {
  const clock = { now: T0 };
  const { app, db } = makeTestApp({ now: () => clock.now });
  app.get("/api/private", requireAuth({ db, now: () => clock.now }), (c) => c.json({ user: c.get("user") }));
  await setupUser(app);
  const cookie = cookieFrom(await login(app, { ...correct, trustDevice: true }));
  clock.now = T0 + 2 * DAY;
  const res = await get(app, "/api/private", { cookie });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ user: expectedUser });
  expect(res.headers.get("set-cookie")).toContain("Max-Age=2592000");
  expect((await get(app, "/api/private")).status).toBe(401);
});

test("untrusted session does not get a new cookie", async () => {
  const clock = { now: T0 };
  const { app } = makeTestApp({ now: () => clock.now });
  await setupUser(app);
  const cookie = cookieFrom(await login(app, correct));
  clock.now = T0 + DAY / 2;
  const res = await get(app, "/api/auth/me", { cookie });
  expect(res.status).toBe(200);
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("me with cookie → user; without → 401", async () => {
  const { app } = makeTestApp();
  const cookie = await setupUser(app);
  const me = await get(app, "/api/auth/me", { cookie });
  expect(me.status).toBe(200);
  expect(await me.json()).toEqual({ user: expectedUser });
  const anonymous = await get(app, "/api/auth/me");
  expect(anonymous.status).toBe(401);
  expect(await anonymous.json()).toEqual({ error: "unauthenticated" });
  const forged = await get(app, "/api/auth/me", { cookie: "fp_session=forged" });
  expect(forged.status).toBe(401);
  expect(await forged.json()).toEqual({ error: "unauthenticated" });
});

test("logout clears cookie and me → 401 afterwards", async () => {
  const { app, db } = makeTestApp();
  const cookie = await setupUser(app);
  const res = await post(app, "/api/auth/logout", undefined, { cookie });
  expect(res.status).toBe(204);
  expect(await res.text()).toBe("");
  const header = res.headers.get("set-cookie") ?? "";
  expect(header).toMatch(/^fp_session=;/);
  expect(header).toContain("Max-Age=0");
  expect(header).toContain("Path=/");
  expect(countRows(db, "sessions")).toBe(0);
  const me = await get(app, "/api/auth/me", { cookie });
  expect(me.status).toBe(401);
});

test("logout without a session still returns 204", async () => {
  const { app } = makeTestApp();
  const res = await post(app, "/api/auth/logout");
  expect(res.status).toBe(204);
  expect(res.headers.get("set-cookie")).toMatch(/^fp_session=;/);
});

test("trustDevice true gives Max-Age 2592000, false gives 86400", async () => {
  const { app, db } = makeTestApp();
  await setupUser(app);
  db.sqlite.prepare("delete from sessions").run();
  const trusted = await login(app, { ...correct, trustDevice: true });
  expect(trusted.status).toBe(200);
  expect(trusted.headers.get("set-cookie")).toContain("Max-Age=2592000");
  const untrusted = await login(app, { ...correct, trustDevice: false });
  expect(untrusted.status).toBe(200);
  expect(untrusted.headers.get("set-cookie")).toContain("Max-Age=86400");
  expect(db.sqlite.prepare("select trusted from sessions order by trusted desc").all()).toEqual([{ trusted: 1 }, { trusted: 0 }]);
});
