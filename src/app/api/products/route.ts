import type { ProductInput } from "@/lib/api/types";
import { requireUser } from "@/server/auth";
import { createProduct, listProducts } from "@/server/catalog";
import { created, handle, readJson } from "@/server/http";

/** Every signed-in role reads the catalog (the till needs it to resolve scanned labels). */
export const GET = handle(async () => {
  await requireUser();
  return listProducts();
});

export const POST = handle(async (request) => {
  const user = await requireUser("products.edit");
  return created(await createProduct(await readJson<ProductInput>(request), user.id));
});
