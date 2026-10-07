/** Central query keys so invalidation stays consistent. */
export const queryKeys = {
  products: ["products"] as const,
  product: (id: string) => ["products", id] as const,
  stockTakes: ["stock", "takes"] as const,
  stockIntakes: ["stock", "intakes"] as const,
  movements: ["stock", "movements"] as const,
  sales: (cashierId?: string) => ["sales", cashierId ?? "all"] as const,
  users: ["users"] as const,
  directory: ["users", "directory"] as const,
  settings: ["settings"] as const,
  audit: ["audit"] as const,
  reportRuns: ["reports", "runs"] as const,
};
