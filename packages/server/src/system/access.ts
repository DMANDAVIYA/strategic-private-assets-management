import type { AccessInfo } from "@financeper/shared";
import { execFile } from "node:child_process";
import dgram from "node:dgram";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type Exec = (file: string, args: string[]) => Promise<{ stdout: string }>;

export type DefaultRouteAddress = () => Promise<string | null>;

export type AccessOptions = {
  port: number;
  exec?: Exec;
  interfaces?: () => NodeJS.Dict<os.NetworkInterfaceInfo[]>;
  defaultRouteAddress?: DefaultRouteAddress;
};

export const EXCLUDED_INTERFACE_NAMES = [
  "vEthernet",
  "WSL",
  "Hyper-V",
  "VirtualBox",
  "VMware",
  "Host-Only",
  "tun",
  "tap",
  "wt",
  "wg",
  "utun",
  "ZeroTier",
  "Hamachi",
  "Loopback",
  "Bluetooth",
  "Tailscale",
] as const;

const ROUTE_PROBE_HOST = "8.8.8.8";
const ROUTE_PROBE_PORT = 53;
const ROUTE_PROBE_TIMEOUT_MS = 500;

const defaultExec: Exec = async (file, args) => {
  const { stdout } = await execFileAsync(file, args, { timeout: 3000, windowsHide: true });
  return { stdout };
};

const probeDefaultRouteAddress: DefaultRouteAddress = () =>
  new Promise((resolve) => {
    let settled = false;
    let socket: dgram.Socket | null = null;
    const finish = (address: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {}
      resolve(address);
    };
    const timer = setTimeout(() => finish(null), ROUTE_PROBE_TIMEOUT_MS);
    try {
      socket = dgram.createSocket("udp4");
      socket.on("error", () => finish(null));
      socket.connect(ROUTE_PROBE_PORT, ROUTE_PROBE_HOST, () => {
        try {
          finish(socket?.address().address ?? null);
        } catch {
          finish(null);
        }
      });
    } catch {
      finish(null);
    }
  });

export function tailscaleBinary(platform: NodeJS.Platform): string {
  return platform === "win32" ? "C:\\Program Files\\Tailscale\\tailscale.exe" : "tailscale";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

const excludedNamePattern = new RegExp(
  `(?:^|[^a-z0-9])(?:${EXCLUDED_INTERFACE_NAMES.map(escapeRegExp).join("|")})[0-9]*(?=$|[^a-z0-9])`,
  "i",
);

export function isExcludedInterfaceName(name: string): boolean {
  return excludedNamePattern.test(name);
}

function isCarrierGradeNat(address: string): boolean {
  const octets = address.split(".").map(Number);
  return octets[0] === 100 && octets[1] !== undefined && octets[1] >= 64 && octets[1] <= 127;
}

function isUsableIpv4(entry: os.NetworkInterfaceInfo): boolean {
  return (
    entry.family === "IPv4" &&
    !entry.internal &&
    !entry.address.startsWith("169.254.") &&
    !isCarrierGradeNat(entry.address)
  );
}

function lanRank(address: string): number {
  return address.startsWith("192.168.") ? 0 : 1;
}

async function listLanUrls(
  port: number,
  interfaces: () => NodeJS.Dict<os.NetworkInterfaceInfo[]>,
  defaultRouteAddress: DefaultRouteAddress,
): Promise<string[]> {
  const addresses: string[] = [];
  for (const [name, entries] of Object.entries(interfaces())) {
    if (isExcludedInterfaceName(name)) {
      continue;
    }
    for (const entry of entries ?? []) {
      if (isUsableIpv4(entry)) {
        addresses.push(entry.address);
      }
    }
  }
  addresses.sort((a, b) => lanRank(a) - lanRank(b));
  let preferred: string | null = null;
  try {
    preferred = await defaultRouteAddress();
  } catch {
    preferred = null;
  }
  if (preferred !== null && addresses.includes(preferred)) {
    addresses.splice(addresses.indexOf(preferred), 1);
    addresses.unshift(preferred);
  }
  return addresses.map((address) => `http://${address}:${port}`);
}

export function isServeActive(serveStatusJson: string, port: number): boolean {
  const targets = [`http://127.0.0.1:${port}`, `http://localhost:${port}`, `127.0.0.1:${port}`, `localhost:${port}`];
  return targets.some((target) => {
    let from = serveStatusJson.indexOf(target);
    while (from !== -1) {
      const next = serveStatusJson.charAt(from + target.length);
      if (!/\d/.test(next)) {
        return true;
      }
      from = serveStatusJson.indexOf(target, from + 1);
    }
    return false;
  });
}

function parseHostname(statusJson: string): string | null {
  try {
    const parsed = JSON.parse(statusJson) as { BackendState?: unknown; Self?: { DNSName?: unknown } };
    const dnsName = parsed.Self?.DNSName;
    if (parsed.BackendState !== "Running" || typeof dnsName !== "string") {
      return null;
    }
    const hostname = dnsName.trim().replace(/\.$/, "");
    return hostname === "" ? null : hostname;
  } catch {
    return null;
  }
}

async function readTailscale(port: number, exec: Exec): Promise<AccessInfo["tailscale"]> {
  const binary = tailscaleBinary(process.platform);
  const none = { installed: false, running: false, hostname: null, httpsUrl: null, serveActive: false };
  try {
    await exec(binary, ["version"]);
  } catch {
    return none;
  }
  const installed = { ...none, installed: true };
  let hostname: string | null;
  try {
    hostname = parseHostname((await exec(binary, ["status", "--json"])).stdout);
  } catch {
    return installed;
  }
  if (hostname === null) {
    return installed;
  }
  let serveActive = false;
  try {
    serveActive = isServeActive((await exec(binary, ["serve", "status", "--json"])).stdout, port);
  } catch {
    serveActive = false;
  }
  return { installed: true, running: true, hostname, httpsUrl: `https://${hostname}`, serveActive };
}

export async function getAccessInfo(options: AccessOptions): Promise<AccessInfo> {
  const exec = options.exec ?? defaultExec;
  const interfaces = options.interfaces ?? os.networkInterfaces;
  const defaultRouteAddress = options.defaultRouteAddress ?? probeDefaultRouteAddress;
  const [lanUrls, tailscale] = await Promise.all([
    listLanUrls(options.port, interfaces, defaultRouteAddress),
    readTailscale(options.port, exec),
  ]);
  return { port: options.port, lanUrls, tailscale };
}
