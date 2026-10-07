"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Sale, SaleInput, StoreSettings } from "@/lib/api/types";

export function useStoreSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api<StoreSettings>("/api/settings"),
    staleTime: 5 * 60_000,
  });
}

/** Live shelf counts for a set of variants: { [variantId]: units }. */
export function fetchAvailability(variantIds: string[]) {
  return api<Record<string, number>>(`/api/stock/availability?variantIds=${variantIds.join(",")}`);
}

export function useCheckout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: SaleInput; idempotencyKey: string }) =>
      api<Sale>("/api/sales", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      }),
    onSettled: () =>
      Promise.all(
        [queryKeys.products, queryKeys.movements, queryKeys.audit, ["sales"] as const].map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
