// Authentication domain services plus the low-level session primitives.
// This module is safe to import in tests: it never imports `next/headers`.
// Cookie wiring lives in `current.ts`.
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Driver, PrismaClient, Seller, User } from "@prisma/client";
import { db } from "@/server/db";
import { ApiError } from "@/server/http";

export const SESSION_COOKIE = "cw_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const BCRYPT_COST = 12;

export type UserRole = User["role"];
export type AuthDb = Pick<PrismaClient, "user" | "session" | "seller" | "driver">;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
}

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

/** Opaque 256-bit session token; only its SHA-256 digest is persisted. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isSessionActive(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() > now.getTime();
}

export function toPublicUser(user: Pick<User, "id" | "email" | "name" | "phone" | "role">): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
  };
}

export async function createSession(
  userId: string,
  client: AuthDb = db,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await client.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function deleteSessionByToken(
  token: string,
  client: AuthDb = db,
): Promise<void> {
  await client.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function getSessionUserByToken(
  token: string,
  client: AuthDb = db,
  now = new Date(),
): Promise<User | null> {
  const session = await client.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || !isSessionActive(session.expiresAt, now)) return null;
  return session.user;
}

/** Public registration is intentionally customer-only. */
export async function registerCustomer(
  input: RegistrationInput,
  client: AuthDb = db,
): Promise<{ user: PublicUser; token: string }> {
  const email = input.email.trim().toLowerCase();
  const existing = await client.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "email_in_use", "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    const user = await client.user.create({
      data: {
        email,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        passwordHash,
        role: "customer",
      },
    });
    const { token } = await createSession(user.id, client);
    return { user: toPublicUser(user), token };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "email_in_use", "An account with this email already exists");
    }
    throw error;
  }
}

/** Returns the user for valid credentials, otherwise null (no enumeration). */
export async function authenticateUser(
  email: string,
  password: string,
  client: AuthDb = db,
): Promise<User | null> {
  const user = await client.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export function assertRole(user: Pick<User, "role">, roles: readonly UserRole[]): void {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "forbidden", "You do not have permission to perform this action");
  }
}

export async function resolveSellerForUser(
  user: Pick<User, "id" | "role">,
  client: AuthDb = db,
): Promise<Seller | null> {
  if (user.role !== "seller") return null;
  return client.seller.findUnique({ where: { ownerUserId: user.id } });
}

export async function requireSellerForUser(
  user: Pick<User, "id" | "role">,
  client: AuthDb = db,
): Promise<Seller> {
  const seller = await resolveSellerForUser(user, client);
  if (!seller) {
    throw new ApiError(403, "seller_profile_missing", "No seller profile is linked to this account");
  }
  return seller;
}

export async function resolveDriverForUser(
  user: Pick<User, "id" | "role">,
  client: AuthDb = db,
): Promise<Driver | null> {
  if (user.role !== "driver") return null;
  return client.driver.findUnique({ where: { userId: user.id } });
}

export async function requireDriverForUser(
  user: Pick<User, "id" | "role">,
  client: AuthDb = db,
): Promise<Driver> {
  const driver = await resolveDriverForUser(user, client);
  if (!driver) {
    throw new ApiError(403, "driver_profile_missing", "No driver profile is linked to this account");
  }
  return driver;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
