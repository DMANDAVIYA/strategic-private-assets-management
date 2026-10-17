import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";

export type Db = {
  sqlite: Database.Database;
  orm: BetterSQLite3Database<typeof schema>;
  close(): void;
};

function resolveMigrationsFolder(): string {
  return process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../../drizzle", import.meta.url));
}

export function openDb(path: string): Db {
  const sqlite = new Database(path);
  if (path !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  sqlite.pragma("foreign_keys = ON");
  const orm = drizzle(sqlite, { schema });
  migrate(orm, { migrationsFolder: resolveMigrationsFolder() });
  return { sqlite, orm, close: () => sqlite.close() };
}
