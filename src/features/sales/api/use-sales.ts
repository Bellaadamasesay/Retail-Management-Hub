"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Sale } from "@/lib/api/types";

/** All sales, or just one cashier's. */
export function useSales(cashierId?: string) {
  return useQuery({
    queryKey: queryKeys.sales(cashierId),
    queryFn: () => api<Sale[]>(cashierId ? `/api/sales?cashierId=${cashierId}` : "/api/sales"),
  });
}
