import type { AuditEntry } from "@/lib/api/types";
import { schema, type Tx } from "./db";

/** Appends to the audit trail inside the caller's transaction, so it is written only if the change is. */
export async function audit(tx: Tx, actorId: string, entry: Omit<AuditEntry, "id" | "at" | "actorId">) {
  await tx.insert(schema.auditLog).values({ actorId, ...entry, changes: entry.changes ?? null });
}
