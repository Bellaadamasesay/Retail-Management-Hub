import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "Audit Logs" };

export default function Page() {
  return <ComingSoon title="Audit Logs" description="See who did what, and when." phase="Phase 7" />;
}
