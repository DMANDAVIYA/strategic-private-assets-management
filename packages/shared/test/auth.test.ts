import { SetupInput, LoginInput } from "../src/index.js";

test("setup input lowercases and trims email", () => {
  const r = SetupInput.parse({ email: "  Owner@Example.COM ", password: "correct horse battery", displayName: " Owner " });
  expect(r.email).toBe("owner@example.com");
  expect(r.displayName).toBe("Owner");
});

test("setup input rejects short password", () => {
  expect(SetupInput.safeParse({ email: "a@b.co", password: "short", displayName: "x" }).success).toBe(false);
});

test("login input defaults trustDevice to false", () => {
  expect(LoginInput.parse({ email: "a@b.co", password: "x" }).trustDevice).toBe(false);
});
