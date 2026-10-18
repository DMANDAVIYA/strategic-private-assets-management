import type { AccessInfo } from "@financeper/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuthStatus, useLogout } from "../src/api/auth";
import { NetworkError } from "../src/api/client";
import { useAccessInfo } from "../src/api/system";
import { AccessPage } from "../src/routes/AccessPage";
import { mutationStub, queryStub, renderPage } from "./helpers";

vi.mock("../src/api/auth", () => ({ useAuthStatus: vi.fn(), useLogout: vi.fn() }));
vi.mock("../src/api/system", () => ({ useAccessInfo: vi.fn() }));

type AccessQuery = ReturnType<typeof useAccessInfo>;
type AuthQuery = ReturnType<typeof useAuthStatus>;
type LogoutMutation = ReturnType<typeof useLogout>;

const LAN_URLS = ["http://192.168.1.20:7777", "http://10.0.0.5:7777"];
const FIRST_LAN_URL = "http://192.168.1.20:7777";
const HTTPS_URL = "https://desktop.tail1234.ts.net";

function accessInfo(tailscale: Partial<AccessInfo["tailscale"]> = {}, lanUrls = LAN_URLS): AccessInfo {
  return {
    port: 7777,
    lanUrls,
    tailscale: { installed: false, running: false, hostname: null, httpsUrl: null, serveActive: false, ...tailscale },
  };
}

function givenAccess(info: AccessInfo) {
  vi.mocked(useAccessInfo).mockReturnValue(queryStub<AccessQuery>({ data: info }));
}

function section(name: string) {
  return within(screen.getByRole("region", { name }));
}

beforeEach(() => {
  vi.mocked(useAuthStatus).mockReturnValue(
    queryStub<AuthQuery>({
      data: { setupRequired: false, authenticated: true, user: { id: 1, email: "a@b.co", displayName: "Alex" } },
    }),
  );
  vi.mocked(useLogout).mockReturnValue(mutationStub<LogoutMutation>());
});

test("not installed renders the three install steps", async () => {
  givenAccess(accessInfo());
  await renderPage(AccessPage, "/settings/access");
  const tailscale = section("Tailscale");
  expect(tailscale.getByText("Tailscale gives your phone a private address that works anywhere.")).toBeInTheDocument();
  const steps = tailscale.getAllByRole("listitem").map((item) => item.textContent);
  expect(steps).toEqual([
    "Install Tailscale on this PC from tailscale.com/download/windows.",
    "Install Tailscale on your iPhone from the App Store.",
    "Sign in to the same account on both, then come back here.",
  ]);
  expect(tailscale.queryByRole("link")).not.toBeInTheDocument();
});

test("installed but not running tells you to start it", async () => {
  givenAccess(accessInfo({ installed: true }));
  await renderPage(AccessPage, "/settings/access");
  expect(
    section("Tailscale").getByText("Start Tailscale on this PC and sign in, then come back here."),
  ).toBeInTheDocument();
});

test("running without serve shows the exact command", async () => {
  givenAccess(accessInfo({ installed: true, running: true, hostname: "desktop.tail1234.ts.net" }));
  await renderPage(AccessPage, "/settings/access");
  const tailscale = section("Tailscale");
  expect(
    tailscale.getByText("Run this once in a terminal opened as administrator, then come back here:"),
  ).toBeInTheDocument();
  const command = tailscale.getByText("tailscale serve --bg 7777");
  expect(command.tagName).toBe("CODE");
  expect(command.textContent).toBe("tailscale serve --bg 7777");
  expect(tailscale.getByText("This gives your phone an https address that works anywhere.")).toBeInTheDocument();
});

test("ready state shows the status line and the https url", async () => {
  givenAccess(
    accessInfo({
      installed: true,
      running: true,
      hostname: "desktop.tail1234.ts.net",
      httpsUrl: HTTPS_URL,
      serveActive: true,
    }),
  );
  await renderPage(AccessPage, "/settings/access");
  const tailscale = section("Tailscale");
  expect(tailscale.getByText("Phone access is ready.")).toHaveClass("text-positive");
  expect(tailscale.getByText(HTTPS_URL)).toBeInTheDocument();
});

test("prefers the https url when serve is active and encodes it in the qr image", async () => {
  givenAccess(accessInfo({ installed: true, running: true, httpsUrl: HTTPS_URL, serveActive: true }));
  await renderPage(AccessPage, "/settings/access");
  const phone = section("Open on your phone");
  expect(phone.getByText(HTTPS_URL)).toBeInTheDocument();
  expect(phone.getByRole("img", { name: `QR code for ${HTTPS_URL}` })).toHaveAttribute(
    "src",
    `/api/system/access/qr.svg?url=${encodeURIComponent(HTTPS_URL)}`,
  );
});

test("falls back to the first lan url when serve is not active", async () => {
  givenAccess(accessInfo({ installed: true, running: true, httpsUrl: HTTPS_URL, serveActive: false }));
  await renderPage(AccessPage, "/settings/access");
  const phone = section("Open on your phone");
  expect(phone.getByText(FIRST_LAN_URL)).toBeInTheDocument();
  expect(phone.queryByText(HTTPS_URL)).not.toBeInTheDocument();
  expect(phone.getByRole("img", { name: `QR code for ${FIRST_LAN_URL}` })).toHaveAttribute(
    "src",
    `/api/system/access/qr.svg?url=${encodeURIComponent(FIRST_LAN_URL)}`,
  );
});

test("copy writes the preferred url to the clipboard and reads Copied", async () => {
  givenAccess(accessInfo());
  const user = userEvent.setup();
  await renderPage(AccessPage, "/settings/access");
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  await user.click(screen.getByRole("button", { name: "Copy" }));
  expect(writeText).toHaveBeenCalledWith(FIRST_LAN_URL);
  expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
});

test("copy is disabled with a hint when the clipboard api is missing", async () => {
  givenAccess(accessInfo());
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  try {
    await renderPage(AccessPage, "/settings/access");
    const copy = screen.getByRole("button", { name: "Copy" });
    expect(copy).toBeDisabled();
    expect(copy).toHaveAttribute("title", "Copy needs a secure address");
  } finally {
    if (descriptor === undefined) {
      delete (navigator as { clipboard?: Clipboard }).clipboard;
    } else {
      Object.defineProperty(navigator, "clipboard", descriptor);
    }
  }
});

test("no address shows the network message and no copy button or qr", async () => {
  givenAccess(accessInfo({}, []));
  await renderPage(AccessPage, "/settings/access");
  const phone = section("Open on your phone");
  expect(phone.getByText("No network address found. Connect this PC to Wi-Fi or Ethernet.")).toBeInTheDocument();
  expect(phone.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
  expect(phone.queryByRole("img")).not.toBeInTheDocument();
});

test("lists every lan url with the same network note", async () => {
  givenAccess(accessInfo());
  await renderPage(AccessPage, "/settings/access");
  const wifi = section("On home Wi-Fi");
  expect(wifi.getAllByRole("listitem").map((item) => item.textContent)).toEqual(LAN_URLS);
  expect(wifi.getByText("Works only when the phone is on the same network as this PC.")).toBeInTheDocument();
});

test("renders the home screen steps", async () => {
  givenAccess(accessInfo());
  await renderPage(AccessPage, "/settings/access");
  const steps = section("Add to Home Screen on iPhone")
    .getAllByRole("listitem")
    .map((item) => item.textContent);
  expect(steps).toEqual([
    "Open the address above in Safari.",
    "Tap Share, then Add to Home Screen.",
    "Tap Add. The app opens full screen from your home screen.",
  ]);
});

test("shows the checking line while loading", async () => {
  vi.mocked(useAccessInfo).mockReturnValue(queryStub<AccessQuery>({ isPending: true }));
  await renderPage(AccessPage, "/settings/access");
  expect(screen.getByText("Checking how your phone can reach this PC…")).toBeInTheDocument();
});

test("shows the error message and refetches on try again", async () => {
  const refetch = vi.fn();
  vi.mocked(useAccessInfo).mockReturnValue(queryStub<AccessQuery>({ isError: true, error: new NetworkError(), refetch }));
  await renderPage(AccessPage, "/settings/access");
  expect(screen.getByText("Couldn't read the network status.")).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
  expect(refetch).toHaveBeenCalledTimes(1);
});
