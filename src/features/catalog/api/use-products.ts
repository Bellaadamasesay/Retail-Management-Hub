"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Product } from "@/lib/api/types";

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => api<Product[]>("/api/products"),
  });
}
