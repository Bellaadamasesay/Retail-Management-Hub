import { can } from "@/lib/rbac/permissions";
import { requireUser } from "@/server/auth";
import { fail, handle, idParam, type Params } from "@/server/http";
import { getSale } from "@/server/sales";

export const GET = handle(async (_request, { params }: Params<"id">) => {
  const user = await requireUser("sales.view_all", "sales.view_own", "pos.use");
  const sale = await getSale(idParam((await params).id, "Sale"));
  if (!sale) throw fail(404, "Sale not found");
  if (!can(user.role, "sales.view_all") && sale.cashierId !== user.id) throw fail(403, "You can only open your own sales.");
  return sale;
});
