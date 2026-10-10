import type { SaleInput } from "@/lib/api/types";
import { can } from "@/lib/rbac/permissions";
import { requireUser } from "@/server/auth";
import { created, fail, handle, isUuid, readJson } from "@/server/http";
import { checkout, listSales } from "@/server/sales";

/** Sales history. Anyone without "all sales" only ever gets their own, whatever they ask for. */
export const GET = handle(async (request) => {
  const user = await requireUser("sales.view_all", "sales.view_own", "pos.use");
  const asked = new URL(request.url).searchParams.get("cashierId");
  if (can(user.role, "sales.view_all")) return listSales(isUuid(asked) ? asked : null);
  if (asked && asked !== user.id) throw fail(403, "You can only see your own sales.");
  return listSales(user.id);
});

export const POST = handle(async (request) => {
  const user = await requireUser("pos.use");
  const { sale, replay } = await checkout(await readJson<SaleInput>(request), user.id, request.headers.get("idempotency-key"));
  return replay ? sale : created(sale);
});
