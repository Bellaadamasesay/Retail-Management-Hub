import type { Category } from "@/lib/api/types";
import { requireUser } from "@/server/auth";
import { created, handle, readJson } from "@/server/http";
import { listTakes, startTake } from "@/server/stock";

export const GET = handle(async () => {
  await requireUser("stocktake.perform", "stocktake.approve");
  return listTakes();
});

export const POST = handle(async (request) => {
  const user = await requireUser("stocktake.perform");
  return created(await startTake(await readJson<{ name: string; scope: Category | "All" }>(request), user.id));
});
