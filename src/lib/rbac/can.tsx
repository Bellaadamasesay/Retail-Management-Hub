"use client";

import type { ReactNode } from "react";
import { usePermission } from "./use-permission";
import type { Permission } from "./permissions";

interface CanProps {
  permission: Permission;
  children: ReactNode;
  /** Rendered when the role lacks the permission (nothing by default). */
  fallback?: ReactNode;
}

/** Shows its children only to roles holding the permission. */
export function Can({ permission, children, fallback = null }: CanProps) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}
