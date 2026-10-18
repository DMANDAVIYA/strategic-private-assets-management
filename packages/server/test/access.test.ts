import { AccessInfoSchema, type AccessInfo } from "@financeper/shared";
import type { NetworkInterfaceInfo } from "node:os";
import { EXCLUDED_INTERFACE_NAMES, getAccessInfo, isExcludedInterfaceName, isServeActive, tailscaleBinary } from "../src/system/access.js";
import { cookieFrom, get, makeTestApp, setupUser } from "./helpers.js";

function iface(address: string, internal = false): NetworkInterfaceInfo {
  return { address, netmask: "255.255.255.0", family: "IPv4", mac: "00:00:00:00:00:00", internal, cidr: `${address}/24` };
}

const interfaces = () => ({
  Loopback: [iface("127.0.0.1", true)],
  Ethernet: [iface("10.0.0.5")],
  "Wi-Fi": [iface("192.168.1.20")],
  Auto: [iface("169.254.1.1")],
  V6: [{ ...iface("fe80::1"), family: "IPv6" as const }] as unknown as NetworkInterfaceInfo[],
});

const statusJson = JSON.stringify({ BackendState: "Running", Self: { DNSName: "hp.tail1234.ts.net." } });
const serveJson = JSON.stringify({
  TCP: { "443": { HTTPS: true } },
  Web: { "hp.tail1234.ts.net:443": { Handlers: { "/": { Proxy: "http://127.0.0.1:7777" } } } },
});

function stubExec(overrides: Record<string, string | Error> = {}) {
  const outputs: Record<string, string | Error> = { version: "1.80.0", status: statusJson, serve: serveJson, ...overrides };
  return async (_file: string, args: string[]) => {
    const out = outputs[args[0] ?? ""];
    if (out instanceof Error) {
      throw out;
    }
    return { stdout: out ?? "" };
  };
}

const noRoute = async () => null;

const ownerInterfaces = () => ({
  wt0: [iface("100.73.225.142")],
  "Ethernet 5": [iface("192.168.56.1")],
  "Wi-Fi": [iface("10.0.0.15")],
  "vEthernet (WSL (Hyper-V firewall))": [iface("172.28.64.1")],
});

test("lists lan urls without internal or link-local, 192.168 first", async () => {
  const info = await getAccessInfo({ port: 7777, exec: stubExec(), interfaces, defaultRouteAddress: noRoute });
  expect(info.lanUrls).toEqual(["http://192.168.1.20:7777", "http://10.0.0.5:7777"]);
});

test("ranks the default route address first and drops tunnel and virtual adapters", async () => {
  const defaultRouteAddress = async () => "10.0.0.15";
  const info = await getAccessInfo({ port: 7777, exec: stubExec(), interfaces: ownerInterfaces, defaultRouteAddress });
  expect(info.lanUrls).toEqual(["http://10.0.0.15:7777", "http://192.168.56.1:7777"]);
});

test("keeps 192.168 first among kept addresses when the route probe finds nothing", async () => {
  const info = await getAccessInfo({ port: 7777, exec: stubExec(), interfaces: ownerInterfaces, defaultRouteAddress: noRoute });
  expect(info.lanUrls).toEqual(["http://192.168.56.1:7777", "http://10.0.0.15:7777"]);
});

test("ignores a route probe address that is not a kept address", async () => {
  const defaultRouteAddress = async () => "172.28.64.1";
  const info = await getAccessInfo({ port: 7777, exec: stubExec(), interfaces: ownerInterfaces, defaultRouteAddress });
  expect(info.lanUrls).toEqual(["http://192.168.56.1:7777", "http://10.0.0.15:7777"]);
});

test("treats a throwing route probe as no route", async () => {
  const defaultRouteAddress = async (): Promise<string | null> => {
    throw new Error("EACCES");
  };
  const info = await getAccessInfo({ port: 7777, exec: stubExec(), interfaces: ownerInterfaces, defaultRouteAddress });
  expect(info.lanUrls).toEqual(["http://192.168.56.1:7777", "http://10.0.0.15:7777"]);
});

test("excludes the carrier-grade nat range only", async () => {
  const ranges = () => ({
    A: [iface("100.63.255.254")],
    B: [iface("100.64.0.1")],
    C: [iface("100.127.255.254")],
    D: [iface("100.128.0.1")],
  });
  const info = await getAccessInfo({ port: 7777, exec: stubExec(), interfaces: ranges, defaultRouteAddress: noRoute });
  expect(info.lanUrls).toEqual(["http://100.63.255.254:7777", "http://100.128.0.1:7777"]);
});

test("excludes virtual, tunnel and tailscale adapters by name", () => {
  for (const name of [
    "vEthernet (Default Switch)",
    "VirtualBox Host-Only Network",
    "VMware Network Adapter VMnet8",
    "wt0",
    "tun0",
    "utun3",
    "wg0",
    "Tailscale",
    "Loopback Pseudo-Interface 1",
    "Bluetooth Network Connection",
    "ZeroTier One [abc]",
    "Hamachi",
  ]) {
    expect(isExcludedInterfaceName(name)).toBe(true);
  }
  for (const name of ["Wi-Fi", "Ethernet", "Ethernet 5", "Network", "eth0", "wlan0"]) {
    expect(isExcludedInterfaceName(name)).toBe(false);
  }
  expect(EXCLUDED_INTERFACE_NAMES).toContain("Tailscale");
});

test("reports a running tailscale with active serve", async () => {
  const info = await getAccessInfo({ port: 7777, exec: stubExec(), interfaces });
  expect(info.tailscale).toEqual({
    installed: true,
    running: true,
    hostname: "hp.tail1234.ts.net",
    httpsUrl: "https://hp.tail1234.ts.net",
    serveActive: true,
  });
});

test("reports serve inactive when it proxies another port", async () => {
  const other = JSON.stringify({ Web: { "x:443": { Handlers: { "/": { Proxy: "http://127.0.0.1:9000" } } } } });
  const info = await getAccessInfo({ port: 7777, exec: stubExec({ serve: other }), interfaces });
  expect(info.tailscale.serveActive).toBe(false);
});

test("reports stopped tailscale without url", async () => {
  const stopped = JSON.stringify({ BackendState: "Stopped", Self: { DNSName: "hp.tail1234.ts.net." } });
  const info = await getAccessInfo({ port: 7777, exec: stubExec({ status: stopped }), interfaces });
  expect(info.tailscale).toEqual({ installed: true, running: false, hostname: null, httpsUrl: null, serveActive: false });
});

test("degrades when exec always fails", async () => {
  const exec = async () => {
    throw new Error("ENOENT");
  };
  const info = await getAccessInfo({ port: 7777, exec, interfaces });
  expect(info.tailscale).toEqual({ installed: false, running: false, hostname: null, httpsUrl: null, serveActive: false });
  expect(info.lanUrls).toHaveLength(2);
});

test("degrades when status output is not json", async () => {
  const info = await getAccessInfo({ port: 7777, exec: stubExec({ status: "nope" }), interfaces });
  expect(info.tailscale).toEqual({ installed: true, running: false, hostname: null, httpsUrl: null, serveActive: false });
});

test("isServeActive recognises proxy targets with and without scheme", () => {
  expect(isServeActive(serveJson, 7777)).toBe(true);
  expect(isServeActive('{"a":"localhost:7777"}', 7777)).toBe(true);
  expect(isServeActive('{"a":"http://localhost:7777"}', 7777)).toBe(true);
  expect(isServeActive('{"a":"http://127.0.0.1:77770"}', 7777)).toBe(false);
  expect(isServeActive("", 7777)).toBe(false);
});

const stubInfo: AccessInfo = {
  port: 7777,
  lanUrls: ["http://192.168.1.20:7777"],
  tailscale: { installed: true, running: true, hostname: "hp.tail1234.ts.net", httpsUrl: "https://hp.tail1234.ts.net", serveActive: true },
};

async function authedApp() {
  const { app } = makeTestApp({ access: async () => stubInfo });
  const cookie = await setupUser(app);
  return { app, cookie };
}

test("access route requires a session", async () => {
  const { app } = await authedApp();
  expect((await get(app, "/api/system/access")).status).toBe(401);
});

test("access route returns access info", async () => {
  const { app, cookie } = await authedApp();
  const res = await get(app, "/api/system/access", { cookie });
  expect(res.status).toBe(200);
  expect(AccessInfoSchema.parse(await res.json())).toEqual(stubInfo);
});

test("qr route requires a session", async () => {
  const { app } = await authedApp();
  expect((await get(app, "/api/system/access/qr.svg?url=http://192.168.1.20:7777")).status).toBe(401);
});

test("qr route rejects foreign hosts and bad schemes", async () => {
  const { app, cookie } = await authedApp();
  for (const url of ["http://evil.example", "ftp://192.168.1.20", "not a url", ""]) {
    const res = await get(app, `/api/system/access/qr.svg?url=${encodeURIComponent(url)}`, { cookie });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_url" });
  }
});

test("qr route renders svg for lan and tailscale urls", async () => {
  const { app, cookie } = await authedApp();
  for (const url of ["http://192.168.1.20:7777", "https://hp.tail1234.ts.net"]) {
    const res = await get(app, `/api/system/access/qr.svg?url=${encodeURIComponent(url)}`, { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(await res.text()).toMatch(/^<svg/);
  }
});

test("resolves the tailscale binary per platform", () => {
  expect(tailscaleBinary("win32")).toBe("C:\\Program Files\\Tailscale\\tailscale.exe");
  expect(tailscaleBinary("win32")).toContain("Program Files\\Tailscale\\tailscale.exe");
  expect(tailscaleBinary("linux")).toBe("tailscale");
});

test("runs version, status and serve status in order against one binary", async () => {
  const calls: Array<[string, string[]]> = [];
  const exec = async (file: string, args: string[]) => {
    calls.push([file, args]);
    return { stdout: args[0] === "status" ? statusJson : args[0] === "serve" ? serveJson : "1.80.0" };
  };
  await getAccessInfo({ port: 7777, exec, interfaces });
  const binary = tailscaleBinary(process.platform);
  expect(calls).toEqual([
    [binary, ["version"]],
    [binary, ["status", "--json"]],
    [binary, ["serve", "status", "--json"]],
  ]);
});
