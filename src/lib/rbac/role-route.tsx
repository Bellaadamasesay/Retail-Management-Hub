"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { Forbidden } from "@/components/shell/forbidden";
import { useSession } from "@/lib/auth/session-context";
import { canAccessPath } from "./routes";

const noopSubscribe = () => () => {};

/**
 * Client-side guard behind the proxy: if the role can't use the current route
 * (e.g. client navigation raced the proxy) show the 403 view instead of the page.
 *
 * Page content renders in the browser only. Every page loads its data there
 * anyway (the server would only ever render loading skeletons), and a page
 * hydrated after the shell could otherwise find data the shell already fetched
 * and no longer match its server HTML.
 */
export function RoleRoute({ children }: { children: ReactNode }) {
  const { role } = useSession();
  const pathname = usePathname();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return canAccessPath(role, pathname) ? <>{children}</> : <Forbidden />;
}
