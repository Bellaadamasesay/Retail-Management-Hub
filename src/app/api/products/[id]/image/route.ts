import { requireUser } from "@/server/auth";
import { productImage } from "@/server/catalog";
import { fail, handle, idParam, type Params } from "@/server/http";

/** The product photo. Its URL carries a version, so browsers may keep it for good. */
export const GET = handle(async (_request, { params }: Params<"id">) => {
  await requireUser();
  const image = await productImage(idParam((await params).id, "Photo"));
  if (!image) throw fail(404, "Photo not found");
  return new Response(new Uint8Array(image.bytes), {
    headers: { "Content-Type": image.type, "Cache-Control": "private, max-age=31536000, immutable" },
  });
});
