import type { AccessInfo } from "./system.js";

export function preferredAccessUrl(info: AccessInfo): string | null {
  if (info.tailscale.serveActive && info.tailscale.httpsUrl !== null) {
    return info.tailscale.httpsUrl;
  }
  return info.lanUrls[0] ?? null;
}
