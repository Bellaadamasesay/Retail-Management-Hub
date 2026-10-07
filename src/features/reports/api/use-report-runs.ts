"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ReportRun } from "@/lib/api/types";

export function useReportRuns() {
  return useQuery({
    queryKey: queryKeys.reportRuns,
    queryFn: () => api<ReportRun[]>("/api/reports/runs"),
  });
}

/** Records that a report was generated or exported, so it appears under Recent Reports. */
export function useLogReportRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (run: Omit<ReportRun, "id" | "at" | "generatedBy">) =>
      api<ReportRun>("/api/reports/runs", { method: "POST", body: JSON.stringify(run) }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.reportRuns }),
  });
}
