import type { ProductInput } from "@/lib/api/types";
import { requireUser } from "@/server/auth";
import { deleteProduct, getProduct, updateProduct } from "@/server/catalog";
import { handle, idParam, readJson, type Params } from "@/server/http";

export const GET = handle(async (_request, { params }: Params<"id">) => {
  await requireUser();
  return getProduct(idParam((await params).id, "Product"));
});

export const PUT = handle(async (request, { params }: Params<"id">) => {
  const user = await requireUser("products.edit");
  return updateProduct(idParam((await params).id, "Product"), await readJson<ProductInput>(request), user.id);
});

export const DELETE = handle(async (_request, { params }: Params<"id">) => {
  const user = await requireUser("products.delete");
  return deleteProduct(idParam((await params).id, "Product"), user.id);
});
