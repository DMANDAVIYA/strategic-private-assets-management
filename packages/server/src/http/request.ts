import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export const UNKNOWN_CLIENT_IP = "unknown";

const LOOPBACK_PROXY_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function socketAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address || undefined;
  } catch {
    return undefined;
  }
}

function isFromLoopbackProxy(c: Context): boolean {
  const address = socketAddress(c);
  return address !== undefined && LOOPBACK_PROXY_ADDRESSES.has(address);
}

export function clientIp(c: Context): string {
  if (isFromLoopbackProxy(c)) {
    const firstForwardedHop = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (firstForwardedHop) {
      return firstForwardedHop;
    }
  }
  return socketAddress(c) ?? UNKNOWN_CLIENT_IP;
}

export function isSecureRequest(c: Context): boolean {
  if (new URL(c.req.url).protocol === "https:") {
    return true;
  }
  return isFromLoopbackProxy(c) && c.req.header("x-forwarded-proto") === "https";
}
