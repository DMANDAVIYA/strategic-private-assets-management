import { preferredAccessUrl, type AccessInfo } from "../src/index.js";

function info(overrides: Partial<AccessInfo["tailscale"]>, lanUrls: string[]): AccessInfo {
  return {
    port: 7777,
    lanUrls,
    tailscale: { installed: true, running: true, hostname: "hp.ts.net", httpsUrl: "https://hp.ts.net", serveActive: true, ...overrides },
  };
}

test("prefers the tailscale https url when serve is active", () => {
  expect(preferredAccessUrl(info({}, ["http://192.168.1.20:7777"]))).toBe("https://hp.ts.net");
});

test("falls back to the first lan url when serve is inactive", () => {
  expect(preferredAccessUrl(info({ serveActive: false }, ["http://192.168.1.20:7777", "http://10.0.0.5:7777"]))).toBe(
    "http://192.168.1.20:7777",
  );
});

test("falls back to the lan url when there is no https url", () => {
  expect(preferredAccessUrl(info({ httpsUrl: null }, ["http://10.0.0.5:7777"]))).toBe("http://10.0.0.5:7777");
});

test("returns null when nothing is reachable", () => {
  expect(preferredAccessUrl(info({ serveActive: false, httpsUrl: null }, []))).toBeNull();
});
