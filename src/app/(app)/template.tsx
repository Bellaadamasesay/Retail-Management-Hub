import type { ReactNode } from "react";
import { PageTransition } from "@/components/providers/page-transition";

/** A template (unlike a layout) remounts on every navigation, which replays the transition inside the shell. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
