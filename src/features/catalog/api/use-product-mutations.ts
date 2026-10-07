"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Product, ProductInput } from "@/lib/api/types";

function useRefreshCatalog() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.products });
}

export function useCreateProduct() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (input: ProductInput) =>
      api<Product>("/api/products", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: refresh,
  });
}

export function useUpdateProduct(id: string) {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (input: ProductInput) =>
      api<Product>(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: refresh,
  });
}

export function useDeleteProduct() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (id: string) => api<Product>(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

/** Undo for a delete: puts the exact product back. */
export function useRestoreProduct() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (product: Product) =>
      api<Product>("/api/products/restore", { method: "POST", body: JSON.stringify(product) }),
    onSuccess: refresh,
  });
}
