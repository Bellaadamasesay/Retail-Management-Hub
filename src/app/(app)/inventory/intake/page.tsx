import type { Metadata } from "next";
import { Suspense } from "react";
import { IntakeView } from "@/features/inventory/components/intake-view";

export const metadata: Metadata = { title: "Stock intake" };

export default function IntakePage() {
  // useSearchParams (?variant= from the Inventory action) needs a Suspense boundary.
  return (
    <Suspense>
      <IntakeView />
    </Suspense>
  );
}
