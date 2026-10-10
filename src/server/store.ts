import { desc, eq } from "drizzle-orm";
import type { AuditChange, AuditEntry, ReportRun, StoreSettings } from "@/lib/api/types";
import { audit } from "./audit";
import { getDb, schema } from "./db";
import { fail } from "./http";

const { settings, auditLog, reportRuns } = schema;

const DEFAULT_SETTINGS: StoreSettings = { storeName: "DaniCess Store", address: "", phone: "" };

/* -------------------------------- Settings -------------------------------- */

export async function getSettings(): Promise<StoreSettings> {
  const [row] = await getDb().select().from(settings).where(eq(settings.id, 1));
  return row ? { storeName: row.storeName, address: row.address, phone: row.phone } : DEFAULT_SETTINGS;
}

export async function updateSettings(input: StoreSettings, actorId: string): Promise<StoreSettings> {
  if (!input?.storeName?.trim()) throw fail(422, "The store needs a name: it’s printed at the top of every receipt.");
  const next: StoreSettings = {
    storeName: input.storeName.trim(),
    address: (input.address ?? "").trim(),
    phone: (input.phone ?? "").trim(),
  };
  const current = await getSettings();
  const labels: Record<keyof StoreSettings, string> = { storeName: "Store name", address: "Address", phone: "Phone" };
  const changes: AuditChange[] = (Object.keys(next) as (keyof StoreSettings)[])
    .filter((k) => next[k] !== current[k])
    .map((k) => ({ field: labels[k], from: current[k] || "–", to: next[k] || "–" }));
  await getDb().transaction(async (tx) => {
    await tx.insert(settings).values({ id: 1, ...next }).onConflictDoUpdate({ target: settings.id, set: next });
    if (changes.length > 0) {
      await audit(tx, actorId, {
        action: "settings.update",
        entity: "store",
        detail: `Changed ${changes.map((c) => c.field.toLowerCase()).join(", ")}`,
        changes,
      });
    }
  });
  return next;
}

/* -------------------------------- Audit log -------------------------------- */

/** Newest first. The most recent 2,000 entries are plenty for the log and the dashboard feed. */
export async function listAudit(): Promise<AuditEntry[]> {
  const rows = await getDb().select().from(auditLog).orderBy(desc(auditLog.at), desc(auditLog.id)).limit(2000);
  return rows.map((r) => ({
    id: String(r.id),
    at: r.at.toISOString(),
    actorId: r.actorId,
    action: r.action as AuditEntry["action"],
    entity: r.entity,
    detail: r.detail,
    ...(r.changes ? { changes: r.changes } : {}),
  }));
}

/* ------------------------------- Report runs ------------------------------- */

const toRun = (r: typeof reportRuns.$inferSelect): ReportRun => ({
  id: r.id,
  name: r.name,
  type: r.type as ReportRun["type"],
  href: r.href,
  at: r.at.toISOString(),
  generatedBy: r.generatedBy,
  from: r.from,
  to: r.to,
});

export async function listReportRuns(): Promise<ReportRun[]> {
  return (await getDb().select().from(reportRuns).orderBy(desc(reportRuns.at)).limit(100)).map(toRun);
}

export async function logReportRun(body: Omit<ReportRun, "id" | "at" | "generatedBy">, actorId: string): Promise<ReportRun> {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!body?.name || !body.type || !body.href || !day.test(body.from ?? "") || !day.test(body.to ?? "")) {
    throw fail(422, "Missing report details.");
  }
  const [row] = await getDb()
    .insert(reportRuns)
    .values({ name: body.name, type: body.type, href: body.href, from: body.from, to: body.to, generatedBy: actorId })
    .returning();
  return toRun(row);
}
