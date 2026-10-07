import type { AuditEntry } from "../types";
import { stockIntakes, stockTakes } from "./stock";
import { sales } from "./sales";
import { formatMoney } from "@/lib/format/money";
import { adminIds } from "./users";

const saleEntries: AuditEntry[] = sales.map((s) => ({
  id: `a-${s.id}`,
  at: s.createdAt,
  actorId: s.cashierId,
  action: "sale.create",
  entity: s.receiptNumber,
  detail: `Sale of ${formatMoney(s.total)} (${s.lines.length} ${s.lines.length === 1 ? "item" : "items"})`,
}));

const intakeEntries: AuditEntry[] = stockIntakes.map((i) => ({
  id: `a-${i.id}`,
  at: i.receivedAt,
  actorId: i.receivedBy,
  action: "stock.intake",
  entity: i.reference,
  detail: `Received ${i.lines.reduce((n, l) => n + l.quantity, 0)} units from ${i.supplier}`,
}));

const takeEntries: AuditEntry[] = stockTakes.flatMap((t) => {
  if (!t.submittedAt) return [];
  const variances = t.lines.filter((l) => l.counted !== null && l.expected !== l.counted).length;
  const submit: AuditEntry = {
    id: `a-${t.id}-submit`,
    at: t.submittedAt,
    actorId: t.createdBy,
    action: "stock.take.submit",
    entity: t.reference,
    detail: `Submitted ${t.name.toLowerCase()} count with ${variances} ${variances === 1 ? "variance" : "variances"}`,
  };
  const approve: AuditEntry[] =
    t.approvedBy && t.approvedAt
      ? [
          {
            id: `a-${t.id}-approve`,
            at: t.approvedAt,
            actorId: t.approvedBy,
            action: "stock.take.approve",
            entity: t.reference,
            detail: `Approved ${t.name.toLowerCase()} count`,
          },
        ]
      : [];
  return [submit, ...approve];
});

const adminEntries: AuditEntry[] = [
  { id: "a-price-1", at: "2026-09-21T10:14:00.000Z", actorId: adminIds[0], action: "product.price_change", entity: "p-scb", detail: `Suede Chelsea Boot price ${formatMoney(450000)} → ${formatMoney(480000)}`, changes: [{ field: "Price", from: formatMoney(450000), to: formatMoney(480000) }] },
  { id: "a-delete-1", at: "2026-09-28T15:40:00.000Z", actorId: adminIds[0], action: "product.delete", entity: "p-old-loafer", detail: "Deleted discontinued product “Penny Loafer”" },
  { id: "a-user-1", at: "2026-08-19T13:10:00.000Z", actorId: adminIds[0], action: "user.revoke", entity: "u-sofia", detail: "Revoked access for Sofia Marques", changes: [{ field: "Access", from: "Active", to: "Revoked" }] },
];

export const auditLog: AuditEntry[] = [
  ...saleEntries,
  ...intakeEntries,
  ...takeEntries,
  ...adminEntries,
].sort((a, b) => b.at.localeCompare(a.at));
