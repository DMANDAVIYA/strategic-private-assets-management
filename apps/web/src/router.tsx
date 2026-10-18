import type { AuthStatus } from "@financeper/shared";
import type { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { authStatusQuery } from "./api/auth";
import { NetworkError, isApiError } from "./api/client";
import { AccessPage } from "./routes/AccessPage";
import { LoginPage } from "./routes/LoginPage";
import { OverviewPage } from "./routes/OverviewPage";
import { SetupPage } from "./routes/SetupPage";
import { UnreachablePage } from "./routes/UnreachablePage";

type RouterContext = { queryClient: QueryClient };

type GuardTarget = "/setup" | "/login" | "/" | null;

const GATEWAY_STATUSES = new Set([502, 503, 504]);

export function isUnreachable(error: unknown): boolean {
  return error instanceof NetworkError || (isApiError(error) && GATEWAY_STATUSES.has(error.status));
}

export function guardTarget(status: AuthStatus, pathname: string): GuardTarget {
  if (status.setupRequired) {
    return pathname === "/setup" ? null : "/setup";
  }
  if (!status.authenticated) {
    return pathname === "/login" ? null : "/login";
  }
  if (pathname === "/setup" || pathname === "/login") {
    return "/";
  }
  return null;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context, location }) => {
    if (location.pathname === "/unreachable") {
      return;
    }
    let status: AuthStatus;
    try {
      status = await context.queryClient.fetchQuery(authStatusQuery);
    } catch (error) {
      if (isUnreachable(error)) {
        throw redirect({ to: "/unreachable", replace: true });
      }
      throw error;
    }
    const target = guardTarget(status, location.pathname);
    if (target !== null) {
      throw redirect({ to: target, replace: true });
    }
  },
  component: Outlet,
});

const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: OverviewPage });
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  beforeLoad: () => {
    throw redirect({ to: "/settings/access", replace: true });
  },
});
const accessRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings/access", component: AccessPage });
const setupRoute = createRoute({ getParentRoute: () => rootRoute, path: "/setup", component: SetupPage });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });
const unreachableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/unreachable",
  component: UnreachablePage,
});

const routeTree = rootRoute.addChildren([
  overviewRoute,
  settingsRoute,
  accessRoute,
  setupRoute,
  loginRoute,
  unreachableRoute,
]);

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({ routeTree, context: { queryClient }, history, defaultPreload: false });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
