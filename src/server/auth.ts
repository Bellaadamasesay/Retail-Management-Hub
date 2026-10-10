import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomInt } from "node:crypto";
import type { User } from "@/lib/api/types";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/rbac/permissions";
import { getDb, schema } from "./db";
import { fail } from "./http";

export type UserRow = typeof schema.users.$inferSelect;

export const toUser = (u: UserRow): User => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role,
  active: u.active,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

/**
 * The signed-in user for this request, re-read from the database. Throws 401
 * when nobody is signed in or the account has been revoked, and 403 when the
 * role lacks every one of `anyOf`.
 */
export async function requireUser(...anyOf: Permission[]): Promise<UserRow> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) throw fail(401, "Sign in to continue.");
  const [user] = await getDb().select().from(schema.users).where(eq(schema.users.id, session.sub));
  if (!user) throw fail(401, "Sign in to continue.");
  if (!user.active) throw fail(401, "Your access has been revoked. Ask a Super Admin to restore it.");
  if (anyOf.length > 0 && !anyOf.some((p) => can(user.role, p))) throw fail(403, "Your role can’t do that.");
  return user;
}

const ROUNDS = 10;
export const hashSecret = (secret: string) => bcrypt.hash(secret, ROUNDS);
export const checkSecret = (secret: string, hash: string | null) => (hash ? bcrypt.compare(secret, hash) : Promise.resolve(false));

const WORDS = ["Amber", "Cedar", "Harbor", "Maple", "Olive", "Linen", "Sandal", "Willow", "Copper", "Thistle", "Coral", "Indigo"];

/** A temporary password the admin reads out: two words and a number, from a secure random source. */
export const temporaryPassword = () =>
  `${WORDS[randomInt(WORDS.length)]}-${WORDS[randomInt(WORDS.length)]}-${randomInt(1000, 10000)}`;

export const newPin = () => String(randomInt(0, 10000)).padStart(4, "0");

/** Wrong tries in a row before an account is paused, and for how long. */
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 5;
