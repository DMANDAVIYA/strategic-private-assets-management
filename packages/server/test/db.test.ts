import { openDb } from "../src/db/index.js";

test("openDb on :memory: creates all tables", () => {
  const db = openDb(":memory:");
  const names = db.sqlite.prepare("select name from sqlite_master where type='table' order by name").all().map((r: any) => r.name);
  expect(names).toEqual(expect.arrayContaining(["users", "sessions", "login_attempts", "settings"]));
  db.close();
});

test("users.email is unique", () => {
  const db = openDb(":memory:");
  const ins = db.sqlite.prepare("insert into users (email, display_name, password_hash, created_at) values (?,?,?,?)");
  ins.run("a@b.co", "A", "h", 1);
  expect(() => ins.run("a@b.co", "B", "h", 2)).toThrow(/UNIQUE/);
  db.close();
});
