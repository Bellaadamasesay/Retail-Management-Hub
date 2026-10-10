import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { listAudit } from "@/server/store";

export const GET = handle(async () => {
  await requireUser("audit.view");
  return listAudit();
});
