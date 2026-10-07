"use client";

import { useEffect, type ReactNode } from "react";
import { registerGsap } from "@/lib/motion/register";

/** Registers GSAP plugins once on the client so every motion hook can rely on them. */
export function MotionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerGsap();
  }, []);

  return <>{children}</>;
}
