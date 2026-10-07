"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { StockIntake, StockMovement } from "@/lib/api/types";

export function useIntakes() {
  return useQuery({
    queryKey: queryKeys.stockIntakes,
    queryFn: () => api<StockIntake[]>("/api/stock/intakes"),
  });
}

export function useMovements() {
  return useQuery({
    queryKey: queryKeys.movements,
    queryFn: () => api<StockMovement[]>("/api/stock/movements"),
  });
}

export interface IntakeInput {
  supplier: string;
  batchNote: string;
  lines: { variantId: string; quantity: number; unitCost: number }[];
}

export function useCreateIntake() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: IntakeInput) =>
      api<StockIntake>("/api/stock/intakes", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () =>
      Promise.all(
        [queryKeys.stockIntakes, queryKeys.products, queryKeys.movements, queryKeys.audit].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
