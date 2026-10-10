import { requireUser } from "@/server/auth";
import { handle, idParam, readJson, type Params } from "@/server/http";
import { getTake, saveTake, type CountLine } from "@/server/stock";

export const GET = handle(async (_request, { params }: Params<"id">) => {
  await requireUser("stocktake.perform", "stocktake.approve");
  return getTake(idParam((await params).id, "Stock take"));
});

/** Save progress on a count (also what draft autosave calls when the network is back). */
export const PUT = handle(async (request, { params }: Params<"id">) => {
  await requireUser("stocktake.perform");
  const { lines } = await readJson<{ lines?: CountLine[] }>(request);
  return saveTake(idParam((await params).id, "Stock take"), lines ?? []);
});
