// Request-scoped session helpers. These import `next/headers` and must only be
// used from Route Handlers, Server Actions or Server Components.
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ApiError } from "@/server/http";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  assertRole,
  deleteSessionByToken,
  getSessionUserByToken,
  requireDriverForUser,
  requireSellerForUser,
  type UserRole,
} from "./session";

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser() {
  // Session expiry compares against the current time, so this read must stay
  // request-time under cacheComponents (it can never be part of a static shell).
  await connection();
  const token = await getSessionToken();
  if (!token) return null;
  return getSessionUserByToken(token);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError(401, "unauthenticated", "Sign in to continue");
  }
  return user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireUser();
  assertRole(user, roles);
  return user;
}

export async function requireCustomer() {
  return requireRole("customer");
}

export async function requireSeller() {
  const user = await requireUser();
  const seller = await requireSellerForUser(user);
  return { user, seller };
}

export async function requireDriver() {
  const user = await requireUser();
  const driver = await requireDriverForUser(user);
  return { user, driver };
}

export async function requireAdmin() {
  return requireRole("admin");
}

/** Logout for route handlers: invalidate the DB row, then clear the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const token = await getSessionToken();
  if (token) await deleteSessionByToken(token);
  await clearSessionCookie();
}
