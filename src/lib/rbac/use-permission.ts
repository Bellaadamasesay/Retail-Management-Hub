"use client";

import { useSession } from "@/lib/auth/session-context";
import { can, type Permission } from "./permissions";

/** True when the signed-in role holds the permission. UX gating only. */
export function usePermission(permission: Permission): boolean {
  return can(useSession().role, permission);
}
