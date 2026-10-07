import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { statusLabel, type StockStatus } from "@/lib/inventory/stock";

const variantByStatus = { in: "success", low: "warning", out: "destructive" } as const;
const iconByStatus = { in: CircleCheck, low: CircleAlert, out: CircleX } as const;

/** In Stock / Low Stock / Out of Stock: colour plus an icon and words, never colour alone. */
export function StockStatusBadge({ status }: { status: StockStatus }) {
  const Icon = iconByStatus[status];
  return (
    <Badge variant={variantByStatus[status]}>
      <Icon aria-hidden="true" />
      {statusLabel[status]}
    </Badge>
  );
}
