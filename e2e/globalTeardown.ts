import { rmSync } from "node:fs";

function removeTempDir(dir: string): boolean {
  try {
    rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export default function globalTeardown(): void {
  const dir = process.env.FP_E2E_TMP;
  if (dir === undefined || dir === "") {
    return;
  }
  if (!removeTempDir(dir)) {
    process.once("exit", () => {
      removeTempDir(dir);
    });
  }
}
