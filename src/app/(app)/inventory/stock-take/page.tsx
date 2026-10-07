import type { Metadata } from "next";
import { StockTakesView } from "@/features/inventory/components/stock-takes-view";

export const metadata: Metadata = { title: "Stock take" };

export default function StockTakePage() {
  return <StockTakesView />;
}
