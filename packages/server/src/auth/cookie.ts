import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { isSecureRequest } from "../http/request.js";

export const SESSION_COOKIE = "fp_session";

function sessionCookieOptions(c: Context) {
  return { httpOnly: true, sameSite: "Lax", path: "/", secure: isSecureRequest(c) } as const;
}

export function secondsUntil(expiresAt: number, now: number): number {
  return Math.floor((expiresAt - now) / 1000);
}

export function readSessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function writeSessionCookie(c: Context, token: string, maxAgeSeconds: number): void {
  setCookie(c, SESSION_COOKIE, token, { ...sessionCookieOptions(c), maxAge: maxAgeSeconds });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, sessionCookieOptions(c));
}
