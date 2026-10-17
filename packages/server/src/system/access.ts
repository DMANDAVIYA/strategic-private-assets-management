import type { AccessInfo } from "@financeper/shared";
import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type Exec = (file: string, args: string[]) => Promise<{ stdout: string }>;

export type AccessOptions = {
  port: number;
  exec?: Exec;
  interfaces?: () => NodeJS.Dict<os.NetworkInterfaceInfo[]>;
};

const defaultExec: Exec = async (file, args) => {
  const { stdout } = await execFileAsync(file, args, { timeout: 3000, windowsHide: true });
  return { stdout };
};

export function tailscaleBinary(platform: NodeJS.Platform): string {
  return platform === "win32" ? "C:\\Program Files\\Tailscale\\tailscale.exe" : "tailscale";
}

function isUsableIpv4(entry: os.NetworkInterfaceInfo): boolean {
  return entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254.");
}

function lanRank(url: string): number {
  return url.startsWith("http://192.168.") ? 0 : 1;
}

function listLanUrls(port: number, interfaces: () => NodeJS.Dict<os.NetworkInterfaceInfo[]>): string[] {
  const urls: string[] = [];
  for (const entries of Object.values(interfaces())) {
    for (const entry of entries ?? []) {
      if (isUsableIpv4(entry)) {
        urls.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return urls.sort((a, b) => lanRank(a) - lanRank(b));
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
  return {
    port: options.port,
    lanUrls: listLanUrls(options.port, interfaces),
    tailscale: await readTailscale(options.port, exec),
  };
}
