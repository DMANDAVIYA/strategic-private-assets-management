import type { Db } from "../db/index.js";

export type AuthDeps = { db: Db; now?: () => number };

export function currentTime(deps: AuthDeps): number {
  return deps.now?.() ?? Date.now();
}
