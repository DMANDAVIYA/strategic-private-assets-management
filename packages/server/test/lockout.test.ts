import { lockoutState, recordAttempt } from "../src/auth/lockout.js";
import { openDb } from "../src/db/index.js";
import { countRows, login, makeTestApp, setupUser, testUser } from "./helpers.js";

const T0 = Date.UTC(2026, 9, 17, 12);
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ip = "192.168.1.20";
const fromIp = { remoteAddress: ip };
const wrong = { email: testUser.email, password: "wrong password" };
const correct = { email: testUser.email, password: testUser.password };

async function lockoutApp() {
  const clock = { now: T0 };
  const { app, db } = makeTestApp({ now: () => clock.now });
  await setupUser(app);
  return { app, db, clock };
}

test("5 failures then correct password → 423 with until", async () => {
  const { app, db, clock } = await lockoutApp();
  for (let i = 0; i < 5; i++) {
    clock.now = T0 + i * 1000;
    expect((await login(app, wrong, fromIp)).status).toBe(401);
  }
  clock.now = T0 + 60_000;
  const res = await login(app, correct, fromIp);
  expect(res.status).toBe(423);
  expect(await res.json()).toEqual({ error: "locked", until: T0 + 4000 + FIFTEEN_MINUTES });
  expect(res.headers.get("set-cookie")).toBeNull();
  expect(countRows(db, "login_attempts", "succeeded = 0")).toBe(6);
  expect(countRows(db, "login_attempts", "succeeded = 1")).toBe(0);
});

test("4 failures then correct password still logs in", async () => {
  const { app, db } = await lockoutApp();
  for (let i = 0; i < 4; i++) {
    expect((await login(app, wrong, fromIp)).status).toBe(401);
  }
  expect((await login(app, correct, fromIp)).status).toBe(200);
  expect(countRows(db, "login_attempts", "succeeded = 1")).toBe(1);
});

test("lock expires after 15 minutes (inject now)", async () => {
  const { app, db, clock } = await lockoutApp();
  for (let i = 0; i < 5; i++) {
    expect((await login(app, wrong, fromIp)).status).toBe(401);
  }
  expect(lockoutState(db, testUser.email, ip, T0 + FIFTEEN_MINUTES - 1)).toEqual({ locked: true, until: T0 + FIFTEEN_MINUTES });
  clock.now = T0 + FIFTEEN_MINUTES;
  expect(lockoutState(db, testUser.email, ip, clock.now)).toEqual({ locked: false });
  expect((await login(app, correct, fromIp)).status).toBe(200);
});

test("lock by ip applies across emails", async () => {
  const { app } = await lockoutApp();
  for (let i = 0; i < 5; i++) {
    expect((await login(app, { email: `guess${i}@b.co`, password: "wrong password" }, fromIp)).status).toBe(401);
  }
  const sameIp = await login(app, correct, fromIp);
  expect(sameIp.status).toBe(423);
  expect(await sameIp.json()).toEqual({ error: "locked", until: T0 + FIFTEEN_MINUTES });
  expect((await login(app, correct, { remoteAddress: "192.168.1.21" })).status).toBe(200);
});

test("lock by email applies across ips", async () => {
  const { app } = await lockoutApp();
  for (let i = 0; i < 5; i++) {
    expect((await login(app, wrong, { remoteAddress: `10.0.0.${i + 1}` })).status).toBe(401);
  }
  expect((await login(app, correct, { remoteAddress: "10.0.0.9" })).status).toBe(423);
});

test("parallel wrong passwords cannot exceed the failure limit", async () => {
  const { app, db } = await lockoutApp();
  const responses = await Promise.all(Array.from({ length: 8 }, () => login(app, wrong, fromIp)));
  expect(responses.map((res) => res.status).sort()).toEqual([401, 401, 401, 401, 401, 423, 423, 423]);
  expect(countRows(db, "login_attempts", "succeeded = 0")).toBe(8);
  expect((await login(app, correct, fromIp)).status).toBe(423);
});

test("attempts record the forwarded ip only behind a loopback proxy, else the socket address", async () => {
  const { app, db } = await lockoutApp();
  const sources = [
    { headers: { "x-forwarded-for": "100.64.0.7, 127.0.0.1" }, remoteAddress: "127.0.0.1" },
    { headers: { "x-forwarded-for": "100.64.0.8" }, remoteAddress: "::1" },
    { headers: { "x-forwarded-for": "100.64.0.9" }, remoteAddress: "::ffff:127.0.0.1" },
    { headers: { "x-forwarded-for": "100.64.0.10" }, remoteAddress: "192.168.1.9" },
    { remoteAddress: "192.168.1.30" },
    { headers: { "x-forwarded-for": "100.64.0.11" } },
  ];
  for (const [i, source] of sources.entries()) {
    expect((await login(app, { email: `probe${i}@b.co`, password: "wrong password" }, source)).status).toBe(401);
  }
  expect(db.sqlite.prepare("select ip from login_attempts order by id").all()).toEqual([
    { ip: "100.64.0.7" },
    { ip: "100.64.0.8" },
    { ip: "100.64.0.9" },
    { ip: "192.168.1.9" },
    { ip: "192.168.1.30" },
    { ip: "unknown" },
  ]);
});

test("spoofed x-forwarded-for from a lan address cannot dodge the ip lock", async () => {
  const { app } = await lockoutApp();
  for (let i = 0; i < 5; i++) {
    const spoofed = { headers: { "x-forwarded-for": `10.9.9.${i}` }, remoteAddress: "192.168.1.9" };
    expect((await login(app, { email: `guess${i}@b.co`, password: "wrong password" }, spoofed)).status).toBe(401);
  }
  const res = await login(app, correct, { headers: { "x-forwarded-for": "10.9.9.99" }, remoteAddress: "192.168.1.9" });
  expect(res.status).toBe(423);
});

test("a success before the fifth failure does not prevent the lock", () => {
  const db = openDb(":memory:");
  recordAttempt(db, testUser.email, ip, false, T0);
  recordAttempt(db, testUser.email, ip, false, T0 + 1);
  recordAttempt(db, testUser.email, ip, false, T0 + 2);
  recordAttempt(db, testUser.email, ip, true, T0 + 3);
  recordAttempt(db, testUser.email, ip, false, T0 + 4);
  recordAttempt(db, testUser.email, ip, false, T0 + 5);
  expect(lockoutState(db, testUser.email, ip, T0 + 10)).toEqual({ locked: true, until: T0 + 5 + FIFTEEN_MINUTES });
  db.close();
});

test("a success after the fifth failure lifts the lock", () => {
  const db = openDb(":memory:");
  for (let i = 0; i < 5; i++) {
    recordAttempt(db, testUser.email, ip, false, T0 + i);
  }
  expect(lockoutState(db, testUser.email, ip, T0 + 5)).toEqual({ locked: true, until: T0 + 4 + FIFTEEN_MINUTES });
  recordAttempt(db, testUser.email, ip, true, T0 + 6);
  expect(lockoutState(db, testUser.email, ip, T0 + 10)).toEqual({ locked: false });
  db.close();
});

test("failures outside the 15 minute window do not count", () => {
  const db = openDb(":memory:");
  recordAttempt(db, testUser.email, ip, false, T0);
  for (let i = 1; i <= 4; i++) {
    recordAttempt(db, testUser.email, ip, false, T0 + FIFTEEN_MINUTES + i);
  }
  expect(lockoutState(db, testUser.email, ip, T0 + FIFTEEN_MINUTES + 10)).toEqual({ locked: false });
  db.close();
});
