import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";
import type { AuditChange, Role, User, UserInput } from "@/lib/api/types";
import { roleLabels } from "@/lib/rbac/permissions";
import { audit } from "./audit";
import { checkSecret, hashSecret, LOCK_MINUTES, MAX_ATTEMPTS, newPin, temporaryPassword, toUser, type UserRow } from "./auth";
import { getDb, schema, type Tx } from "./db";
import { fail, isUniqueViolation, isUuid } from "./http";

const { users } = schema;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = Object.keys(roleLabels) as Role[];

/* --------------------------------- Sign-in --------------------------------- */

export type LoginBody = { email?: string; password?: string; remember?: boolean } | { userId?: string; pin?: string };

/**
 * Checks a password (email) or PIN (shared till) sign-in. Wrong tries count
 * towards a short lock, so a 4-digit PIN can't simply be guessed.
 */
export async function verifyLogin(body: LoginBody): Promise<UserRow> {
  const db = getDb();
  const byPin = "pin" in body && typeof body.pin === "string";
  const [user] = byPin
    ? isUuid((body as { userId?: string }).userId)
      ? await db.select().from(users).where(eq(users.id, (body as { userId: string }).userId))
      : []
    : await db
        .select()
        .from(users)
        .where(eq(sql`lower(${users.email})`, String((body as { email?: string }).email ?? "").trim().toLowerCase()));

  const wrong = byPin
    ? "That PIN doesn’t match. Try again or ask your Super Admin to reset it."
    : "That email and password don’t match. Check them and try again.";
  if (!user) throw fail(401, wrong);
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw fail(429, `Too many wrong tries. Wait ${LOCK_MINUTES} minutes, or ask your Super Admin to reset ${byPin ? "the PIN" : "the password"}.`);
  }

  const ok = byPin
    ? await checkSecret((body as { pin: string }).pin, user.pinHash)
    : await checkSecret(String((body as { password?: string }).password ?? ""), user.passwordHash);
  if (!ok) {
    const attempts = user.failedAttempts + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    await db
      .update(users)
      .set({ failedAttempts: lock ? 0 : attempts, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
      .where(eq(users.id, user.id));
    throw fail(401, wrong);
  }
  if (!user.active) throw fail(403, "This account has been deactivated. Ask a Super Admin to restore access.");

  const [signedIn] = await db
    .update(users)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  return signedIn;
}

/** Active staff who can sign in with a PIN, for the name picker on shared tills. */
export async function pinUsers() {
  return getDb()
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.active, true), isNotNull(users.pinHash)))
    .orderBy(asc(users.name));
}

/* ---------------------------------- Staff ---------------------------------- */

export async function listUsers(): Promise<User[]> {
  return (await getDb().select().from(users).orderBy(asc(users.createdAt))).map(toUser);
}

/** Names only, so any screen can say who did something without exposing emails or roles. */
export async function directory() {
  return getDb().select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.createdAt));
}

function validateInput(input: UserInput) {
  if (!input?.name?.trim()) throw fail(422, "Enter the person’s name.");
  if (!EMAIL.test(input.email?.trim() ?? "")) throw fail(422, "Enter a valid email address.");
  if (!ROLES.includes(input.role)) throw fail(422, "Choose a role.");
}

async function loadUser(tx: Tx, id: string): Promise<UserRow> {
  if (!isUuid(id)) throw fail(404, "That person isn’t on the list any more.");
  const [user] = await tx.select().from(users).where(eq(users.id, id)).for("update");
  if (!user) throw fail(404, "That person isn’t on the list any more.");
  return user;
}

async function activeAdminCount(tx: Tx, except?: string) {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "SUPER_ADMIN"), eq(users.active, true), except ? ne(users.id, except) : undefined));
  return rows.length;
}

const duplicateEmail = (error: unknown) =>
  isUniqueViolation(error) ? fail(409, "Someone already uses that email address.") : error;

export async function createUser(input: UserInput, actorId: string) {
  validateInput(input);
  const email = input.email.trim().toLowerCase();
  const password = temporaryPassword();
  const pin = input.role === "CASHIER" ? newPin() : undefined;
  const [passwordHash, pinHash] = await Promise.all([hashSecret(password), pin ? hashSecret(pin) : null]);
  try {
    const user = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ name: input.name.trim(), username: email.split("@")[0], email, role: input.role, passwordHash, pinHash })
        .returning();
      await audit(tx, actorId, {
        action: "user.create",
        entity: row.id,
        detail: `Added ${row.name} as ${roleLabels[row.role]}`,
        changes: [{ field: "Role", from: "–", to: roleLabels[row.role] }],
      });
      return row;
    });
    return { user: toUser(user), temporaryPassword: password, pin };
  } catch (error) {
    throw duplicateEmail(error);
  }
}

export async function updateUser(id: string, input: UserInput, actorId: string): Promise<User> {
  validateInput(input);
  const email = input.email.trim().toLowerCase();
  try {
    return await getDb().transaction(async (tx) => {
      const user = await loadUser(tx, id);
      if (user.role === "SUPER_ADMIN" && input.role !== "SUPER_ADMIN" && user.active && (await activeAdminCount(tx, id)) === 0) {
        throw fail(409, "There has to be at least one Super Admin. Make someone else an admin first.");
      }
      const changes: AuditChange[] = [];
      if (user.name !== input.name.trim()) changes.push({ field: "Name", from: user.name, to: input.name.trim() });
      if (user.email !== email) changes.push({ field: "Email", from: user.email, to: email });
      if (user.role !== input.role) changes.push({ field: "Role", from: roleLabels[user.role], to: roleLabels[input.role] });

      // A cashier needs a PIN for the till; other roles don't use one.
      const pinHash = input.role === "CASHIER" ? user.pinHash : null;
      const [row] = await tx
        .update(users)
        .set({ name: input.name.trim(), email, role: input.role, pinHash })
        .where(eq(users.id, id))
        .returning();
      if (changes.length > 0) {
        await audit(tx, actorId, {
          action: "user.update",
          entity: id,
          detail: `Updated ${row.name}: ${changes.map((c) => c.field.toLowerCase()).join(", ")}`,
          changes,
        });
      }
      return toUser(row);
    });
  } catch (error) {
    throw duplicateEmail(error);
  }
}

export async function resetPassword(id: string, actorId: string) {
  const password = temporaryPassword();
  const passwordHash = await hashSecret(password);
  await getDb().transaction(async (tx) => {
    const user = await loadUser(tx, id);
    await tx.update(users).set({ passwordHash, failedAttempts: 0, lockedUntil: null }).where(eq(users.id, id));
    await audit(tx, actorId, { action: "user.reset_credentials", entity: id, detail: `Reset the password for ${user.name}` });
  });
  return { temporaryPassword: password };
}

export async function resetPin(id: string, actorId: string) {
  const pin = newPin();
  const pinHash = await hashSecret(pin);
  await getDb().transaction(async (tx) => {
    const user = await loadUser(tx, id);
    if (user.role !== "CASHIER") throw fail(409, "Only cashiers sign in with a PIN.");
    await tx.update(users).set({ pinHash, failedAttempts: 0, lockedUntil: null }).where(eq(users.id, id));
    await audit(tx, actorId, { action: "user.reset_credentials", entity: id, detail: `Reset the PIN for ${user.name}` });
  });
  return { pin };
}

export async function setAccess(id: string, active: boolean, actorId: string): Promise<User> {
  return getDb().transaction(async (tx) => {
    const user = await loadUser(tx, id);
    if (!active && user.id === actorId) throw fail(409, "You can’t revoke your own access.");
    if (!active && user.role === "SUPER_ADMIN" && user.active && (await activeAdminCount(tx, id)) === 0) {
      throw fail(409, "There has to be at least one Super Admin.");
    }
    if (user.active === active) throw fail(409, active ? `${user.name} already has access.` : `${user.name} already has no access.`);
    const [row] = await tx.update(users).set({ active }).where(eq(users.id, id)).returning();
    await audit(tx, actorId, {
      action: active ? "user.restore" : "user.revoke",
      entity: id,
      detail: active ? `Restored access for ${user.name}` : `Revoked access for ${user.name}`,
      changes: [{ field: "Access", from: active ? "Revoked" : "Active", to: active ? "Active" : "Revoked" }],
    });
    return toUser(row);
  });
}
