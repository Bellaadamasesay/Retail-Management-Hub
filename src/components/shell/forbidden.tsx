"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/brand/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session-context";
import { roleLabels } from "@/lib/rbac/permissions";
import { landingPath } from "@/lib/rbac/routes";

/** 403: the role can't use this screen. Explains why and offers the way home. */
export function Forbidden() {
  const { role } = useSession();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 items-center py-16">
      <EmptyState
        className="w-full bg-card"
        icon={<ShieldAlert className="size-6" />}
        title="This area isn’t part of your role"
        description={`${roleLabels[role]} accounts can’t open this page. If you think that’s a mistake, ask a Super Admin to review your access.`}
        action={
          <Link href={landingPath[role]} className={buttonVariants({ size: "sm" })}>
            Back to my home
          </Link>
        }
      />
    </div>
  );
}
