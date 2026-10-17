import { openDb } from "../src/db/index.js";
import { getSetting, seedDefaults, setSetting } from "../src/settings.js";

test("seedDefaults inserts display currency and timezone", () => {
  const db = openDb(":memory:");
  seedDefaults(db);
  expect(getSetting(db, "displayCurrency")).toBe("USD");
  expect(getSetting(db, "timezone")).toBe("America/New_York");
  db.close();
});

test("seedDefaults keeps values that already exist", () => {
  const db = openDb(":memory:");
  setSetting(db, "displayCurrency", "EUR");
  seedDefaults(db);
  seedDefaults(db);
  expect(getSetting(db, "displayCurrency")).toBe("EUR");
  expect(getSetting(db, "timezone")).toBe("America/New_York");
  db.close();
});

test("settings round-trip json values and overwrite", () => {
  const db = openDb(":memory:");
  expect(getSetting(db, "layout")).toBeUndefined();
  setSetting(db, "layout", { columns: [1, 2], compact: true });
  expect(getSetting<{ columns: number[]; compact: boolean }>(db, "layout")).toEqual({ columns: [1, 2], compact: true });
  setSetting(db, "layout", 3);
  expect(getSetting<number>(db, "layout")).toBe(3);
  expect(db.sqlite.prepare("select value from settings where key = 'layout'").get()).toEqual({ value: "3" });
  db.close();
});
