import { users } from "./users";

/** Mock sign-in credentials. Dev/demo only: the real backend owns authentication. */
export const DEMO_PASSWORD = "retailhub123";

const DEMO_PINS = ["4821", "3057", "7742", "1596", "6083", "2915"];

/**
 * Cashier tablets sign in with a 4-digit PIN. Active cashiers are handed the
 * demo PINs in roster order, so editing the staff list never leaves anyone
 * without one.
 */
export const pins: Record<string, string> = Object.fromEntries(
  users
    .filter((u) => u.role === "CASHIER" && u.active)
    .map((u, i) => [u.id, DEMO_PINS[i % DEMO_PINS.length]]),
);
