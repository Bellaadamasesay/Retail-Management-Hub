import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils";

interface MoneyProps {
  /** Integer minor units (e.g. cents). */
  amount: number;
  className?: string;
}

export function Money({ amount, className }: MoneyProps) {
  return <span className={cn("tabular", className)}>{formatMoney(amount)}</span>;
}
