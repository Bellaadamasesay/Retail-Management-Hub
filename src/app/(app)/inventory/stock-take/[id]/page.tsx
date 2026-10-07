import type { Metadata } from "next";
import { StockTakeDetail } from "@/features/inventory/components/stock-take-detail";

export const metadata: Metadata = { title: "Stock take" };

export default async function StockTakeDetailPage({ params }: PageProps<"/inventory/stock-take/[id]">) {
  const { id } = await params;
  return <StockTakeDetail id={id} />;
}
