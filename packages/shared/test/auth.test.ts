import { SetupInput, LoginInput } from "../src/index.js";

test("setup input lowercases and trims email", () => {
  const r = SetupInput.parse({ email: "  Dhruvil@Example.COM ", password: "correct horse battery", displayName: " Dhruvil " });
  expect(r.email).toBe("dhruvil@example.com");
  expect(r.displayName).toBe("Dhruvil");
});

test("setup input rejects short password", () => {
  expect(SetupInput.safeParse({ email: "a@b.co", password: "short", displayName: "x" }).success).toBe(false);
});

test("login input defaults trustDevice to false", () => {
  expect(LoginInput.parse({ email: "a@b.co", password: "x" }).trustDevice).toBe(false);
});
