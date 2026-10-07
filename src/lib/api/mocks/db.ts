import {
  auditLog,
  products,
  sales,
  stockIntakes,
  stockTakes,
  users,
} from "../fixtures";
import { DEMO_PASSWORD, pins } from "../fixtures/credentials";
import type { AuditEntry, Product, Sale, StockIntake, StockMovement, StockTake, StoreSettings, User, ReportRun } from "../types";
import { appNow } from "@/lib/time";
import { buildLedger } from "./ledger";

/**
 * In-memory "database" behind the mock API. Seeded from the fixtures and, in
 * the browser, persisted to localStorage so a demo keeps its changes across
 * reloads. The real backend replaces this whole folder.
 */
export interface MockDb {
  products: Product[];
  sales: Sale[];
  stockIntakes: StockIntake[];
  stockTakes: StockTake[];
  /** Every change to stock, oldest first. */
  movements: StockMovement[];
  users: User[];
  /** Sign-in secrets by user id. Real passwords would be hashed server-side; this is demo data. */
  credentials: Record<string, { password: string; pin?: string }>;
  audit: AuditEntry[];
  settings: StoreSettings;
  reportRuns: ReportRun[];
  /** Idempotency-Key -> the sale it created, so a retried checkout never sells twice. */
  idempotency: Record<string, string>;
}

const STORAGE_KEY = "rh-mock-db-v6";
const REV_KEY = `${STORAGE_KEY}-rev`;

function seedReportRuns(base: { users: Pick<User, "id" | "role">[] }): ReportRun[] {
  const admin = base.users.find((u) => u.role === "SUPER_ADMIN")?.id ?? "";
  const keeper = base.users.find((u) => u.role === "INVENTORY_KEEPER")?.id ?? admin;
  return [
    { id: "rr-5", name: "Weekly Sales Report", type: "Sales", href: "/reports", at: "2026-10-05T09:10:00.000Z", generatedBy: admin, from: "2026-09-29", to: "2026-10-05" },
    { id: "rr-4", name: "Stock Movement Report", type: "Stock Movement", href: "/reports/stock-movement", at: "2026-10-04T16:20:00.000Z", generatedBy: keeper, from: "2026-09-01", to: "2026-09-30" },
    { id: "rr-3", name: "Revenue & Profit Report", type: "Revenue & Profit", href: "/reports/revenue", at: "2026-10-03T11:15:00.000Z", generatedBy: admin, from: "2026-09-01", to: "2026-09-30" },
    { id: "rr-2", name: "Variance Report", type: "Variance", href: "/reports/variance", at: "2026-10-02T14:40:00.000Z", generatedBy: admin, from: "2026-09-01", to: "2026-09-30" },
    { id: "rr-1", name: "Stock Movement Report", type: "Stock Movement", href: "/reports/stock-movement", at: "2026-09-30T10:05:00.000Z", generatedBy: keeper, from: "2026-09-23", to: "2026-09-29" },
  ];
}

function seed(): MockDb {
  const raw = structuredClone({
    products,
    sales,
    stockIntakes,
    stockTakes,
    users,
    audit: auditLog,
  });
  // Accounts were opened a few weeks apart, in roster order, ending a couple of months before "now".
  const base = {
    ...raw,
    users: raw.users.map<User>((u, i) => ({
      ...u,
      createdAt: new Date(Date.UTC(2026, 6, 6 + i * 9, 9, 30)).toISOString(),
    })),
  };
  // The ledger reconciles variant stock so movement balances add up.
  return {
    ...base,
    movements: buildLedger(base),
    settings: {
      storeName: "RetailHub",
      address: "Siaka Stevens Street, Freetown",
      phone: "+232 76 000 000",
    },
    credentials: Object.fromEntries(base.users.map((u) => [u.id, { password: DEMO_PASSWORD, ...(pins[u.id] ? { pin: pins[u.id] } : {}) }])),
    idempotency: {},
    reportRuns: seedReportRuns(base),
  };
}

function load(): MockDb {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // Storage blocked or corrupt: fall back to a fresh seed.
  }
  return seed();
}

let state: MockDb | null = null;
let rev: string | null = null;

/** Revision of what is stored, bumped on every save, so several tabs of one browser share one database. */
function storedRev(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REV_KEY);
  } catch {
    return null;
  }
}

export function getDb(): MockDb {
  // Another tab may have saved since we last looked: pick up its changes.
  if (state && typeof window !== "undefined") {
    const current = storedRev();
    if (current !== null && current !== rev) {
      state = load();
      rev = current;
    }
  }
  if (!state) {
    state = load();
    rev = storedRev();
  }
  return state;
}

/** Persist after any write. */
export function saveDb() {
  if (typeof window === "undefined" || !state) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    rev = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(REV_KEY, rev);
  } catch {
    // Quota or blocked storage: the in-memory copy still works for this session.
  }
}

/** Back to the seeded fixtures (tests, and the "reset demo data" action). */
export function resetDb() {
  state = seed();
  rev = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(REV_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * "Now" for records the mock API creates: the app clock, but never earlier than
 * the newest stored record, so a reload (which restarts the clock) can't
 * create entries that sort before ones saved in the previous session.
 */
export function mockNow(): string {
  const db = getDb();
  const latest = Math.max(
    0,
    ...db.sales.map((s) => Date.parse(s.createdAt)),
    ...db.stockIntakes.map((i) => Date.parse(i.receivedAt)),
    ...db.movements.map((m) => Date.parse(m.at)),
    ...db.audit.slice(0, 1).map((a) => Date.parse(a.at)),
  );
  return new Date(Math.max(appNow().getTime(), latest + 1000)).toISOString();
}
