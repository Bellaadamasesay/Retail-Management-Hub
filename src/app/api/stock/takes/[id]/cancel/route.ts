import { can } from "@/lib/rbac/permissions";
import { requireUser } from "@/server/auth";
import { handle, idParam, type Params } from "@/server/http";
import { cancelTake } from "@/server/stock";

export const POST = handle(async (_request, { params }: Params<"id">) => {
  const user = await requireUser("stocktake.perform", "stocktake.approve");
  return cancelTake(idParam((await params).id, "Stock take"), { id: user.id, canApprove: can(user.role, "stocktake.approve") });
});
