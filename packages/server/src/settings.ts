import { eq } from "drizzle-orm";
import type { Db } from "./db/index.js";
import { settings } from "./db/schema.js";

export const DEFAULT_SETTINGS = {
  displayCurrency: "USD",
  timezone: "America/New_York",
} as const;

export function seedDefaults(db: Db): void {
  const rows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value: JSON.stringify(value) }));
  db.orm.insert(settings).values(rows).onConflictDoNothing().run();
}

export function getSetting<T>(db: Db, key: string): T | undefined {
  const row = db.orm.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get();
  return row === undefined ? undefined : (JSON.parse(row.value) as T);
}

export function setSetting<T>(db: Db, key: string, value: T): void {
  const json = JSON.stringify(value);
  db.orm
    .insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json } })
    .run();
}
