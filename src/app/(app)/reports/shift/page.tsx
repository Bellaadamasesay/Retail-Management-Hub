import type { Metadata } from "next";
import { ShiftReport } from "@/features/reports/components/shift-report";

export const metadata: Metadata = { title: "My shift totals" };

export default function Page() {
  return <ShiftReport />;
}
