"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { AuditEntry } from "@/lib/api/types";

/** The audit trail, newest first. Super Admin only. */
export function useAudit() {
  return useQuery({
    queryKey: queryKeys.audit,
    queryFn: () => api<AuditEntry[]>("/api/audit"),
  });
}
