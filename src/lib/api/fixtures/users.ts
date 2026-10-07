import type { SeedUser } from "../types";

export const users: SeedUser[] = [
  { id: "u-amara", name: "Bella Sesay", username: "bella", email: "bella@retailhub.com", role: "SUPER_ADMIN", active: true, lastLoginAt: "2026-10-05T07:42:00.000Z" },
  { id: "u-daniel", name: "Miss Barrie", username: "missy", email: "missy@retailhub.com", role: "INVENTORY_KEEPER", active: true, lastLoginAt: "2026-10-05T07:55:00.000Z" },
  { id: "u-mei", name: "Dominic Oladapo", username: "dominic", email: "dominic@retailhub.com", role: "CASHIER", active: true, lastLoginAt: "2026-10-04T12:58:00.000Z" },
];

export const cashierIds = users
  .filter((u) => u.role === "CASHIER" && u.active)
  .map((u) => u.id);

/**
 * Seed data and tests pick staff by role rather than by name or id, so the
 * demo roster above can be edited freely (renamed, added to, trimmed).
 */
export const adminIds = users.filter((u) => u.role === "SUPER_ADMIN" && u.active).map((u) => u.id);
export const keeperIds = users.filter((u) => u.role === "INVENTORY_KEEPER" && u.active).map((u) => u.id);
