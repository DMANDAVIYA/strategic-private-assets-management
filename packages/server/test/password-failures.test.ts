import * as argon2 from "@node-rs/argon2";
import { hashPassword, verifyPassword } from "../src/auth/password.js";
import { login, makeTestApp, setupUser, testUser } from "./helpers.js";

vi.mock("@node-rs/argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@node-rs/argon2")>();
  return { ...actual, hash: vi.fn(actual.hash), verify: vi.fn(actual.verify) };
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("verifyPassword treats only a malformed hash as a mismatch", async () => {
  expect(await verifyPassword("not-a-hash", testUser.password)).toBe(false);
  expect(await verifyPassword("", testUser.password)).toBe(false);
  const hash = await hashPassword(testUser.password);
  vi.mocked(argon2.verify).mockRejectedValueOnce(new Error("argon2 worker failed"));
  await expect(verifyPassword(hash, testUser.password)).rejects.toThrow("argon2 worker failed");
});

test("an argon2 failure during login is a 500, not invalid_credentials", async () => {
  const { app, db } = makeTestApp();
  await setupUser(app);
  vi.mocked(argon2.verify).mockRejectedValueOnce(new Error("argon2 worker failed"));
  const res = await login(app, { email: testUser.email, password: testUser.password });
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: "internal" });
  expect(res.headers.get("set-cookie")).toBeNull();
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ message: "argon2 worker failed" }));
  expect(db.sqlite.prepare("select count(*) as n from login_attempts").get()).toEqual({ n: 0 });
  const retry = await login(app, { email: testUser.email, password: testUser.password });
  expect(retry.status).toBe(200);
});

test("a failed dummy hash for unknown emails is retried instead of cached", async () => {
  const { app } = makeTestApp();
  await setupUser(app);
  const unknown = { email: "nobody@b.co", password: testUser.password };
  vi.mocked(argon2.hash).mockRejectedValueOnce(new Error("argon2 worker failed"));
  const first = await login(app, unknown);
  expect(first.status).toBe(500);
  const second = await login(app, unknown);
  expect(second.status).toBe(401);
  expect(await second.json()).toEqual({ error: "invalid_credentials" });
});
