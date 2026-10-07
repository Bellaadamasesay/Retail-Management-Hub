import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <ComingSoon title="Settings" description="Store details and preferences." phase="Phase 7" />;
}
