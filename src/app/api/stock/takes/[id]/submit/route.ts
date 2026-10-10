import { requireUser } from "@/server/auth";
import { handle, idParam, readJson, type Params } from "@/server/http";
import { submitTake, type CountLine } from "@/server/stock";

export const POST = handle(async (request, { params }: Params<"id">) => {
  const user = await requireUser("stocktake.perform");
  const { lines } = await readJson<{ lines?: CountLine[] }>(request);
  return submitTake(idParam((await params).id, "Stock take"), lines ?? [], user.id);
});
