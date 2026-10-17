import { startServer } from "../src/index.js";

test("startServer listens, answers /api/health and closes", async () => {
  const server = await startServer({ dbPath: ":memory:", host: "127.0.0.1", port: 0 });
  try {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(server.url).not.toMatch(/:0$/);
    const res = await fetch(`${server.url}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  } finally {
    await server.close();
  }
});

test("startServer rejects when the port is already in use", async () => {
  const first = await startServer({ dbPath: ":memory:", host: "127.0.0.1", port: 0 });
  try {
    const port = Number(new URL(first.url).port);
    await expect(startServer({ dbPath: ":memory:", host: "127.0.0.1", port })).rejects.toMatchObject({ code: "EADDRINUSE" });
  } finally {
    await first.close();
  }
});
