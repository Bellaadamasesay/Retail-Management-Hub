import type { ReportRun } from "@/lib/api/types";
import { requireUser } from "@/server/auth";
import { created, handle, readJson } from "@/server/http";
import { listReportRuns, logReportRun } from "@/server/store";

const REPORTS = ["reports.financial", "reports.stock_movement", "reports.shift_totals"] as const;

export const GET = handle(async () => {
  await requireUser(...REPORTS);
  return listReportRuns();
});

/** Log that a report was generated or exported, so it shows under Recent Reports. */
export const POST = handle(async (request) => {
  const user = await requireUser(...REPORTS);
  return created(await logReportRun(await readJson<Omit<ReportRun, "id" | "at" | "generatedBy">>(request), user.id));
});
