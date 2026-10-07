"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Category, StockTake, VarianceReason } from "@/lib/api/types";

export function useStockTakes() {
  return useQuery({
    queryKey: queryKeys.stockTakes,
    queryFn: () => api<StockTake[]>("/api/stock/takes"),
  });
}

export function useStockTake(id: string) {
  return useQuery({
    queryKey: [...queryKeys.stockTakes, id],
    queryFn: () => api<StockTake>(`/api/stock/takes/${id}`),
  });
}

export interface CountLineInput {
  variantId: string;
  counted: number | null;
  reason?: VarianceReason;
}

/** Everything that changes a count also changes stock and the ledger, so refresh all of it. */
function useRefreshStock() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.stockTakes }),
      client.invalidateQueries({ queryKey: queryKeys.products }),
      client.invalidateQueries({ queryKey: queryKeys.movements }),
      client.invalidateQueries({ queryKey: queryKeys.audit }),
    ]);
}

export function useCreateStockTake() {
  const refresh = useRefreshStock();
  return useMutation({
    mutationFn: (input: { name: string; scope: Category | "All" }) =>
      api<StockTake>("/api/stock/takes", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: refresh,
  });
}

export function useSaveCounts(id: string) {
  const refresh = useRefreshStock();
  return useMutation({
    mutationFn: (lines: CountLineInput[]) =>
      api<StockTake>(`/api/stock/takes/${id}`, { method: "PUT", body: JSON.stringify({ lines }) }),
    onSuccess: refresh,
  });
}

export function useSubmitStockTake(id: string) {
  const refresh = useRefreshStock();
  return useMutation({
    mutationFn: (lines: CountLineInput[]) =>
      api<StockTake>(`/api/stock/takes/${id}/submit`, { method: "POST", body: JSON.stringify({ lines }) }),
    onSuccess: refresh,
  });
}

export function useApproveStockTake(id: string) {
  const refresh = useRefreshStock();
  return useMutation({
    mutationFn: () => api<StockTake>(`/api/stock/takes/${id}/approve`, { method: "POST" }),
    onSuccess: refresh,
  });
}

export function useCancelStockTake(id: string) {
  const refresh = useRefreshStock();
  return useMutation({
    mutationFn: () => api<StockTake>(`/api/stock/takes/${id}/cancel`, { method: "POST" }),
    onSuccess: refresh,
  });
}
