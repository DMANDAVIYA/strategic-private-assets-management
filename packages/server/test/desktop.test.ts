import { cookieFrom, countRows, get, login, makeTestApp, setupUser, testUser } from "./helpers.js";

const desktopToken = "desktop-token-0123456789abcdefghijklmnopqrstuv";
const enterPath = `/desktop/enter?token=${desktopToken}`;

async function expectForbidden(res: Response): Promise<void> {
  expect(res.status).toBe(403);
  expect(res.headers.get("set-cookie")).toBeNull();
  expect(await res.json()).toEqual({ error: "forbidden" });
}

test("right token from loopback before setup redirects to /setup", async () => {
  const { app, db } = makeTestApp({ desktopToken });
  const res = await get(app, enterPath, { remoteAddress: "127.0.0.1" });
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/setup");
  expect(res.headers.get("set-cookie")).toBeNull();
  expect(countRows(db, "sessions")).toBe(0);
});

test.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])("right token from %s after setup signs in with a trusted session", async (remoteAddress) => {
  const { app, db } = makeTestApp({ desktopToken });
  await setupUser(app);
  const res = await get(app, enterPath, { remoteAddress, headers: { "user-agent": "financeper-desktop" } });
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/");
  const header = res.headers.get("set-cookie") ?? "";
  expect(header).toMatch(/^fp_session=[A-Za-z0-9_-]{43};/);
  expect(header).toContain("Max-Age=2592000");
  expect(header).toContain("HttpOnly");
  expect(header).toContain("SameSite=Lax");
  expect(header).toContain("Path=/");
  expect(countRows(db, "sessions", "trusted = 1")).toBe(1);
  expect(db.sqlite.prepare("select ip, user_agent as userAgent from sessions where trusted = 1").get()).toEqual({
    ip: remoteAddress,
    userAgent: "financeper-desktop",
  });
  const me = await get(app, "/api/auth/me", { cookie: cookieFrom(res) });
  expect(me.status).toBe(200);
  expect(await me.json()).toMatchObject({ user: { email: testUser.email } });
});

test("right token from a lan address is forbidden", async () => {
  const { app, db } = makeTestApp({ desktopToken });
  await setupUser(app);
  await expectForbidden(await get(app, enterPath, { remoteAddress: "192.168.1.9" }));
  expect(countRows(db, "sessions", "trusted = 1")).toBe(0);
});

test("right token with an unknown socket address is forbidden", async () => {
  const { app } = makeTestApp({ desktopToken });
  await setupUser(app);
  await expectForbidden(await get(app, enterPath));
});

test("right token proxied from a remote client through loopback is forbidden", async () => {
  const { app } = makeTestApp({ desktopToken });
  await setupUser(app);
  const res = await get(app, enterPath, { remoteAddress: "127.0.0.1", headers: { "x-forwarded-for": "100.64.0.7" } });
  await expectForbidden(res);
});

test.each([
  ["a wrong token of the same length", `/desktop/enter?token=${"x".repeat(desktopToken.length)}`],
  ["a wrong token of a different length", "/desktop/enter?token=short"],
  ["an empty token", "/desktop/enter?token="],
  ["a missing token", "/desktop/enter"],
])("%s from loopback is forbidden", async (_label, path) => {
  const { app } = makeTestApp({ desktopToken });
  await setupUser(app);
  await expectForbidden(await get(app, path, { remoteAddress: "127.0.0.1" }));
});

test.each([
  ["no desktop token configured", undefined],
  ["an empty desktop token configured", ""],
])("with %s every token is forbidden", async (_label, configured) => {
  const { app } = makeTestApp({ desktopToken: configured });
  await setupUser(app);
  await expectForbidden(await get(app, "/desktop/enter?token=", { remoteAddress: "127.0.0.1" }));
  await expectForbidden(await get(app, "/desktop/enter?token=undefined", { remoteAddress: "127.0.0.1" }));
});

test("desktop entry still signs the owner in while password login is locked out", async () => {
  const { app } = makeTestApp({ desktopToken });
  await setupUser(app);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await login(app, { email: testUser.email, password: "wrong password" }, { remoteAddress: "127.0.0.1" });
  }
  const locked = await login(app, { email: testUser.email, password: testUser.password }, { remoteAddress: "127.0.0.1" });
  expect(locked.status).toBe(423);
  const res = await get(app, enterPath, { remoteAddress: "127.0.0.1" });
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/");
  expect(res.headers.get("set-cookie")).toContain("Max-Age=2592000");
});

test("desktop entry carries the security headers", async () => {
  const { app } = makeTestApp({ desktopToken });
  const res = await get(app, enterPath, { remoteAddress: "127.0.0.1" });
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("x-frame-options")).toBe("DENY");
});

test("desktop entry with a valid session cookie redirects without creating another session", async () => {
  const { app, db } = makeTestApp({ desktopToken });
  await setupUser(app);
  const first = await get(app, enterPath, { remoteAddress: "127.0.0.1" });
  const cookie = cookieFrom(first);
  const sessionsAfterFirstEntry = countRows(db, "sessions");
  const second = await get(app, enterPath, { remoteAddress: "127.0.0.1", cookie });
  expect(second.status).toBe(302);
  expect(second.headers.get("location")).toBe("/");
  expect(second.headers.get("set-cookie")).toBeNull();
  expect(countRows(db, "sessions")).toBe(sessionsAfterFirstEntry);
  const me = await get(app, "/api/auth/me", { cookie });
  expect(me.status).toBe(200);
});

test("desktop entry with a stale session cookie signs the owner in again", async () => {
  const { app, db } = makeTestApp({ desktopToken });
  await setupUser(app);
  const res = await get(app, enterPath, { remoteAddress: "127.0.0.1", cookie: "fp_session=stale-token" });
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/");
  expect(res.headers.get("set-cookie")).toMatch(/^fp_session=/);
  expect(countRows(db, "sessions", "trusted = 1")).toBe(1);
});

test("desktop entry replaces an untrusted session with a trusted one", async () => {
  const { app, db } = makeTestApp({ desktopToken });
  const setupCookie = await setupUser(app);
  expect(countRows(db, "sessions", "trusted = 0")).toBe(1);
  const res = await get(app, enterPath, { remoteAddress: "127.0.0.1", cookie: setupCookie });
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/");
  expect(res.headers.get("set-cookie")).toContain("Max-Age=2592000");
  expect(countRows(db, "sessions", "trusted = 1")).toBe(1);
  expect(countRows(db, "sessions", "trusted = 0")).toBe(0);
  expect((await get(app, "/api/auth/me", { cookie: setupCookie })).status).toBe(401);
  expect((await get(app, "/api/auth/me", { cookie: cookieFrom(res) })).status).toBe(200);
});
