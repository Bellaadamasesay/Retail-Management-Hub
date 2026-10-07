import { HttpResponse, http } from "msw";
import { roleLabels } from "@/lib/rbac/permissions";
import type { AuditChange, StoreSettings, User, UserInput } from "../../types";
import { getDb, saveDb } from "../db";
import { audit, fail, NOW, requireRole, route } from "./common";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WORDS = ["Amber", "Cedar", "Harbor", "Maple", "Olive", "Linen", "Sandal", "Willow", "Copper", "Thistle"];
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** A temporary password the admin reads out: two words and a number. */
const temporaryPassword = () => `${pick(WORDS)}-${pick(WORDS)}-${Math.floor(1000 + Math.random() * 9000)}`;
const newPin = () => String(Math.floor(1000 + Math.random() * 9000));

function activeAdmins() {
  return getDb().users.filter((u) => u.role === "SUPER_ADMIN" && u.active);
}

const idFor = (name: string, taken: Set<string>) => {
  const base = `u-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user"}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
};

export const userHandlers = [
  /**
   * Sign-in check. Not behind the revoked-account guard, because this is
   * where a revoked person finds out. The cookie itself is issued by the
   * Next route handler, which can set httpOnly cookies (a browser-side mock can't).
   */
  http.post("/api/auth/verify", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; userId?: string; pin?: string };
    const db = getDb();
    const byPin = typeof body.pin === "string";
    const user = byPin
      ? db.users.find((u) => u.id === body.userId && db.credentials[u.id]?.pin === body.pin)
      : db.users.find(
          (u) => u.email.toLowerCase() === (body.email ?? "").trim().toLowerCase() && db.credentials[u.id]?.password === body.password,
        );
    if (!user) {
      return fail(
        401,
        byPin
          ? "That PIN doesn’t match. Try again or ask your Super Admin to reset it."
          : "That email and password don’t match. Check them and try again.",
      );
    }
    if (!user.active) return fail(403, "This account has been deactivated. Ask a Super Admin to restore access.");
    user.lastLoginAt = NOW();
    saveDb();
    return HttpResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  }),

  /** Active staff who can sign in with a PIN, for the name picker on shared cashier tablets. */
  http.get("/api/auth/pin-users", () => {
    const db = getDb();
    return HttpResponse.json(
      db.users.filter((u) => u.active && db.credentials[u.id]?.pin).map((u) => ({ id: u.id, name: u.name })),
    );
  }),

  /** Names only, so any screen can say who did something without exposing emails or roles. */
  route.get("/api/users/directory", () => HttpResponse.json(getDb().users.map((u) => ({ id: u.id, name: u.name })))),

  route.get("/api/users", ({ request }) => {
    const actor = requireRole(request, "SUPER_ADMIN");
    if (actor instanceof Response) return actor;
    return HttpResponse.json(getDb().users);
  }),

  route.post("/api/users", async ({ request }) => {
    const actor = requireRole(request, "SUPER_ADMIN");
    if (actor instanceof Response) return actor;
    const input = (await request.json()) as UserInput;
    const db = getDb();
    if (!input.name?.trim()) return fail(422, "Enter the person’s name.");
    if (!EMAIL.test(input.email?.trim() ?? "")) return fail(422, "Enter a valid email address.");
    if (!(input.role in roleLabels)) return fail(422, "Choose a role.");
    if (db.users.some((u) => u.email.toLowerCase() === input.email.trim().toLowerCase())) {
      return fail(409, "Someone already uses that email address.");
    }

    const user: User = {
      id: idFor(input.name, new Set(db.users.map((u) => u.id))),
      name: input.name.trim(),
      username: input.email.trim().split("@")[0].toLowerCase(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      active: true,
      lastLoginAt: null,
      createdAt: NOW(),
    };
    const password = temporaryPassword();
    const pin = input.role === "CASHIER" ? newPin() : undefined;
    db.users.push(user);
    db.credentials[user.id] = { password, ...(pin ? { pin } : {}) };
    audit(request, {
      action: "user.create",
      entity: user.id,
      detail: `Added ${user.name} as ${roleLabels[user.role]}`,
      changes: [{ field: "Role", from: "–", to: roleLabels[user.role] }],
    });
    saveDb();
    return HttpResponse.json({ user, temporaryPassword: password, pin }, { status: 201 });
  }),

  route.put("/api/users/:id", async ({ params, request }) => {
    const actor = requireRole(request, "SUPER_ADMIN");
    if (actor instanceof Response) return actor;
    const input = (await request.json()) as UserInput;
    const db = getDb();
    const user = db.users.find((u) => u.id === params.id);
    if (!user) return fail(404, "That person isn’t on the list any more.");
    if (!input.name?.trim()) return fail(422, "Enter the person’s name.");
    if (!EMAIL.test(input.email?.trim() ?? "")) return fail(422, "Enter a valid email address.");
    if (!(input.role in roleLabels)) return fail(422, "Choose a role.");
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === email)) {
      return fail(409, "Someone already uses that email address.");
    }
    if (user.role === "SUPER_ADMIN" && input.role !== "SUPER_ADMIN" && user.active && activeAdmins().length <= 1) {
      return fail(409, "There has to be at least one Super Admin. Make someone else an admin first.");
    }

    const changes: AuditChange[] = [];
    if (user.name !== input.name.trim()) changes.push({ field: "Name", from: user.name, to: input.name.trim() });
    if (user.email !== email) changes.push({ field: "Email", from: user.email, to: email });
    if (user.role !== input.role) changes.push({ field: "Role", from: roleLabels[user.role], to: roleLabels[input.role] });

    user.name = input.name.trim();
    user.email = email;
    user.role = input.role;
    if (changes.length > 0) {
      audit(request, {
        action: "user.update",
        entity: user.id,
        detail: `Updated ${user.name}: ${changes.map((c) => c.field.toLowerCase()).join(", ")}`,
        changes,
      });
    }
    saveDb();
    return HttpResponse.json(user);
  }),

  route.post("/api/users/:id/reset-password", ({ params, request }) => {
    const actor = requireRole(request, "SUPER_ADMIN");
    if (actor instanceof Response) return actor;
    const db = getDb();
    const user = db.users.find((u) => u.id === params.id);
    if (!user) return fail(404, "That person isn’t on the list any more.");
    const password = temporaryPassword();
    db.credentials[user.id] = { ...db.credentials[user.id], password };
    audit(request, { action: "user.reset_credentials", entity: user.id, detail: `Reset the password for ${user.name}` });
    saveDb();
    return HttpResponse.json({ temporaryPassword: password });
  }),

  route.post("/api/users/:id/reset-pin", ({ params, request }) => {
    const actor = requireRole(request, "SUPER_ADMIN");
    if (actor instanceof Response) return actor;
    const db = getDb();
    const user = db.users.find((u) => u.id === params.id);
    if (!user) return fail(404, "That person isn’t on the list any more.");
    if (user.role !== "CASHIER") return fail(409, "Only cashiers sign in with a PIN.");
    const pin = newPin();
    db.credentials[user.id] = { ...db.credentials[user.id], pin };
    audit(request, { action: "user.reset_credentials", entity: user.id, detail: `Reset the PIN for ${user.name}` });
    saveDb();
    return HttpResponse.json({ pin });
  }),

  route.post("/api/users/:id/revoke", ({ params, request }) => {
    const actor = requireRole(request, "SUPER_ADMIN");
    if (actor instanceof Response) return actor;
    const db = getDb();
    const user = db.users.find((u) => u.id === params.id);
    if (!user) return fail(404, "That person isn’t on the list any more.");
    if (user.id === actor.id) return fail(409, "You can’t revoke your own access.");
    if (user.role === "SUPER_ADMIN" && user.active && activeAdmins().length <= 1) {
      return fail(409, "There has to be at least one Super Admin.");
    }
    if (!user.active) return fail(409, `${user.name} already has no access.`);
    user.active = false;
    audit(request, {
      action: "user.revoke",
      entity: user.id,
      detail: `Revoked access for ${user.name}`,
      changes: [{ field: "Access", from: "Active", to: "Revoked" }],
    });
    saveDb();
    return HttpResponse.json(user);
  }),

  route.post("/api/users/:id/restore", ({ params, request }) => {
    const actor = requireRole(request, "SUPER_ADMIN");
    if (actor instanceof Response) return actor;
    const db = getDb();
    const user = db.users.find((u) => u.id === params.id);
    if (!user) return fail(404, "That person isn’t on the list any more.");
    if (user.active) return fail(409, `${user.name} already has access.`);
    user.active = true;
    audit(request, {
      action: "user.restore",
      entity: user.id,
      detail: `Restored access for ${user.name}`,
      changes: [{ field: "Access", from: "Revoked", to: "Active" }],
    });
    saveDb();
    return HttpResponse.json(user);
  }),

  route.get("/api/audit", ({ request }) => {
    const actor = requireRole(request, "SUPER_ADMIN");
    if (actor instanceof Response) return actor;
    return HttpResponse.json(getDb().audit);
  }),

  route.put("/api/settings", async ({ request }) => {
    const actor = requireRole(request, "SUPER_ADMIN");
    if (actor instanceof Response) return actor;
    const input = (await request.json()) as StoreSettings;
    const db = getDb();
    if (!input.storeName?.trim()) return fail(422, "The store needs a name: it’s printed at the top of every receipt.");
    const next: StoreSettings = {
      storeName: input.storeName.trim(),
      address: (input.address ?? "").trim(),
      phone: (input.phone ?? "").trim(),
    };
    const labels: Record<keyof StoreSettings, string> = { storeName: "Store name", address: "Address", phone: "Phone" };
    const changes: AuditChange[] = (Object.keys(next) as (keyof StoreSettings)[])
      .filter((k) => next[k] !== db.settings[k])
      .map((k) => ({ field: labels[k], from: db.settings[k] || "–", to: next[k] || "–" }));
    db.settings = next;
    if (changes.length > 0) {
      audit(request, {
        action: "settings.update",
        entity: "store",
        detail: `Changed ${changes.map((c) => c.field.toLowerCase()).join(", ")}`,
        changes,
      });
    }
    saveDb();
    return HttpResponse.json(db.settings);
  }),
];
