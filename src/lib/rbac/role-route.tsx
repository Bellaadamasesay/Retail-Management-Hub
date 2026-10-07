"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Forbidden } from "@/components/shell/forbidden";
import { useSession } from "@/lib/auth/session-context";
import { canAccessPath } from "./routes";

/**
 * Client-side guard behind the proxy: if the role can't use the current route
 * (e.g. client navigation raced the proxy) show the 403 view instead of the page.
 */
export function RoleRoute({ children }: { children: ReactNode }) {
  const { role } = useSession();
  const pathname = usePathname();
  return canAccessPath(role, pathname) ? <>{children}</> : <Forbidden />;
}
