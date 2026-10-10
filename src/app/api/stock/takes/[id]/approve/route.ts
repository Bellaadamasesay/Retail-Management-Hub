import { requireUser } from "@/server/auth";
import { handle, idParam, type Params } from "@/server/http";
import { approveTake } from "@/server/stock";

/** Super Admin only: applies the differences to stock and closes the count. */
export const POST = handle(async (_request, { params }: Params<"id">) => {
  const user = await requireUser("stocktake.approve");
  return approveTake(idParam((await params).id, "Stock take"), user.id);
});
