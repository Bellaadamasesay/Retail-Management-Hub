import { requireUser } from "@/server/auth";
import { handle, isUuid } from "@/server/http";
import { listMovements } from "@/server/stock";

export const GET = handle(async (request) => {
  await requireUser("inventory.view", "dashboard.view", "reports.stock_movement", "reports.financial");
  const variantId = new URL(request.url).searchParams.get("variantId");
  return listMovements(isUuid(variantId) ? variantId : null);
});
