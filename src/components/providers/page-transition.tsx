"use client";

import type { ReactNode } from "react";
import { usePageTransition } from "@/lib/motion/use-page-transition";

export function PageTransition({ children }: { children: ReactNode }) {
  const ref = usePageTransition();
  return (
    <div ref={ref} className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
