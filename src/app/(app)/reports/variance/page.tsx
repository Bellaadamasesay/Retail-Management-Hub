import type { Metadata } from "next";
import { VarianceReport } from "@/features/reports/components/variance-report";

export const metadata: Metadata = { title: "Variance" };

export default function Page() {
  return <VarianceReport />;
}
