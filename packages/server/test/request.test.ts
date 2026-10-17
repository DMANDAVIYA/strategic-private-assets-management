import { Hono } from "hono";
import { clientIp, isSecureRequest } from "../src/http/request.js";
import { get } from "./helpers.js";

const probeApp = new Hono();
probeApp.get("/probe", (c) => c.json({ ip: clientIp(c), secure: isSecureRequest(c) }));

const forwarded = { "x-forwarded-for": "100.64.0.7, 127.0.0.1", "x-forwarded-proto": "https" };

async function probe(options: Parameters<typeof get>[2]): Promise<{ ip: string; secure: boolean }> {
  return (await (await get(probeApp, "/probe", options)).json()) as { ip: string; secure: boolean };
}

test.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])("forwarded headers are honored from loopback %s", async (remoteAddress) => {
  expect(await probe({ headers: forwarded, remoteAddress })).toEqual({ ip: "100.64.0.7", secure: true });
});

test("forwarded headers are ignored from 192.168.1.9", async () => {
  expect(await probe({ headers: forwarded, remoteAddress: "192.168.1.9" })).toEqual({ ip: "192.168.1.9", secure: false });
});

test("forwarded headers are ignored when the socket address is unknown", async () => {
  expect(await probe({ headers: forwarded })).toEqual({ ip: "unknown", secure: false });
});

test("loopback without forwarded headers uses the socket address", async () => {
  expect(await probe({ remoteAddress: "127.0.0.1" })).toEqual({ ip: "127.0.0.1", secure: false });
});

test("an https url is secure from any address", async () => {
  expect(await probe({ remoteAddress: "192.168.1.9", url: "https://localhost/probe" })).toEqual({ ip: "192.168.1.9", secure: true });
});
