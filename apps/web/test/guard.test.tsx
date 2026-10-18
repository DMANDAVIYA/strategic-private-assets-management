import type { AuthStatus } from "@financeper/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppRouter } from "../src/router";
import { jsonResponse, testQueryClient } from "./helpers";

const alex = { id: 1, email: "a@b.co", displayName: "Alex" };
const fresh: AuthStatus = { setupRequired: true, authenticated: false, user: null };
const loggedOut: AuthStatus = { setupRequired: false, authenticated: false, user: null };
const loggedIn: AuthStatus = { setupRequired: false, authenticated: true, user: alex };

function statusFetch(status: AuthStatus) {
  return vi.fn(async () => jsonResponse(200, status));
}

async function renderApp(path: string) {
  const queryClient = testQueryClient();
  const router = createAppRouter(queryClient, createMemoryHistory({ initialEntries: [path] }));
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => {
  vi.useRealTimers();
});

test("network failure redirects to /unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
  const router = await renderApp("/");
  expect(await screen.findByRole("heading", { level: 1, name: "Can't reach your PC" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/unreachable");
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});

test("gateway failure redirects to /unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Gateway", { status: 502 })));
  const router = await renderApp("/");
  expect(await screen.findByRole("heading", { level: 1, name: "Can't reach your PC" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/unreachable");
});

test("setupRequired redirects to /setup", async () => {
  vi.stubGlobal("fetch", statusFetch(fresh));
  const router = await renderApp("/");
  expect(await screen.findByRole("heading", { level: 1, name: "Set up your account" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/setup");
});

test("unauthenticated redirects to /login", async () => {
  vi.stubGlobal("fetch", statusFetch(loggedOut));
  const router = await renderApp("/settings/access");
  expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
});

test("authenticated on /login goes to the overview inside the shell", async () => {
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 17, 12)));
  vi.stubGlobal("fetch", statusFetch(loggedIn));
  const router = await renderApp("/login");
  expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
  expect(screen.getByText("Nothing to show yet")).toBeInTheDocument();
  expect(screen.getByText("Sat, Oct 17, 2026")).toBeInTheDocument();
  expect(screen.getByText("Alex")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings/access");
  const ledger = screen.getByText("Ledger");
  expect(ledger).toHaveAttribute("aria-disabled", "true");
  expect(ledger).not.toHaveAttribute("href");
  const checkIn = screen.getByRole("button", { name: "Tonight's check-in" });
  expect(checkIn).toBeDisabled();
  expect(checkIn).toHaveAttribute("title", "Coming in a later phase");
  expect(screen.getByText("USD")).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("INR")).toHaveAttribute("aria-pressed", "false");
});

test("try again on /unreachable navigates home once the PC answers", async () => {
  const fetchMock = vi.fn<() => Promise<Response>>(async () => Promise.reject(new TypeError("Failed to fetch")));
  vi.stubGlobal("fetch", fetchMock);
  const router = await renderApp("/");
  await screen.findByRole("heading", { level: 1, name: "Can't reach your PC" });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Can't reach your PC" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/unreachable");
  fetchMock.mockImplementation(async () => jsonResponse(200, loggedIn));
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/");
});

test("log out returns to /login", async () => {
  let loggedOutNow = false;
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      loggedOutNow = true;
      return new Response(null, { status: 204 });
    }
    return jsonResponse(200, loggedOutNow ? loggedOut : loggedIn);
  });
  vi.stubGlobal("fetch", fetchMock);
  const router = await renderApp("/");
  await screen.findByRole("heading", { level: 1, name: "Overview" });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Log out" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
});
