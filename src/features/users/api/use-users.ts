"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { StaffName, User } from "@/lib/api/types";

/** Full staff list (Super Admin only). */
export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () => api<User[]>("/api/users"),
  });
}

/** Names only: every role can read this, so any screen can say who did something. */
export function useDirectory() {
  return useQuery({
    queryKey: queryKeys.directory,
    queryFn: () => api<StaffName[]>("/api/users/directory"),
    staleTime: 5 * 60_000,
  });
}

/** Resolves a user id to a name for tables and feeds ("Unknown" until staff load or if the account is gone). */
export function useStaffName() {
  const { data } = useDirectory();
  return useCallback((id: string) => data?.find((u) => u.id === id)?.name ?? "Unknown", [data]);
}
