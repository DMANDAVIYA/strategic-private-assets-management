import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

export const UNKNOWN_CLIENT_IP = "unknown";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

type SocketBindings = { incoming?: { socket?: { encrypted?: unknown } } };

export function remoteAddressOf(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address || undefined;
  } catch {
    return undefined;
  }
}

function isLoopbackAddress(address: string | undefined): boolean {
  return address !== undefined && LOOPBACK_ADDRESSES.has(address);
}

function isLoopbackConnection(c: Context): boolean {
  return isLoopbackAddress(remoteAddressOf(c));
}

export function clientIp(c: Context): string {
  if (isLoopbackConnection(c)) {
    const firstForwardedHop = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (firstForwardedHop) {
      return firstForwardedHop;
    }
  }
  return remoteAddressOf(c) ?? UNKNOWN_CLIENT_IP;
}

export function isLocalClient(c: Context): boolean {
  return isLoopbackConnection(c) && isLoopbackAddress(clientIp(c));
}

function isEncryptedSocket(c: Context): boolean {
  return (c.env as SocketBindings | undefined)?.incoming?.socket?.encrypted === true;
}

export function isSecureRequest(c: Context): boolean {
  return isEncryptedSocket(c) || (isLoopbackConnection(c) && c.req.header("x-forwarded-proto") === "https");
}

export function userAgentOf(c: Context): string {
  return c.req.header("user-agent") ?? "";
}
