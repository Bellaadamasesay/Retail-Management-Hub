import type { Metadata } from "next";
import { StockMovementReport } from "@/features/reports/components/stock-movement-report";

export const metadata: Metadata = { title: "Stock movement" };

export default function Page() {
  return <StockMovementReport />;
}
