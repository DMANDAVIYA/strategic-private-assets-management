import { startServer } from "./index.js";

function readPort(raw: string | undefined): number {
  const port = Number(raw || 7777);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`FP_PORT must be an integer from 0 to 65535, got "${raw}"`);
  }
  return port;
}

const server = await startServer({
  dbPath: process.env.FP_DB || "./dev.db",
  host: process.env.FP_HOST || "0.0.0.0",
  port: readPort(process.env.FP_PORT),
  staticDir: process.env.FP_STATIC || undefined,
  desktopToken: process.env.FP_DESKTOP_TOKEN || undefined,
});

console.log(server.url);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void server.close().finally(() => process.exit(0));
  });
}
