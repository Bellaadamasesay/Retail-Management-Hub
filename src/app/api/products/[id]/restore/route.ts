import { requireUser } from "@/server/auth";
import { restoreProduct } from "@/server/catalog";
import { created, handle, idParam, type Params } from "@/server/http";

/** Undo for a delete. */
export const POST = handle(async (_request, { params }: Params<"id">) => {
  const user = await requireUser("products.delete");
  return created(await restoreProduct(idParam((await params).id, "Product"), user.id));
});
