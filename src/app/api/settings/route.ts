import type { StoreSettings } from "@/lib/api/types";
import { requireUser } from "@/server/auth";
import { handle, readJson } from "@/server/http";
import { getSettings, updateSettings } from "@/server/store";

/** Store details printed on receipts: every role reads them. */
export const GET = handle(async () => {
  await requireUser();
  return getSettings();
});

export const PUT = handle(async (request) => {
  const user = await requireUser("settings.manage");
  return updateSettings(await readJson<StoreSettings>(request), user.id);
});
