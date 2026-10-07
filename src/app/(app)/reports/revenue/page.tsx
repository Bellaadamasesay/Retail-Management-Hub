import type { Metadata } from "next";
import { RevenueReport } from "@/features/reports/components/revenue-report";

export const metadata: Metadata = { title: "Revenue & Profit" };

export default function Page() {
  return <RevenueReport />;
}
