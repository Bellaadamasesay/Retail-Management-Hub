"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session-context";
import { roleLabels } from "@/lib/rbac/permissions";
import { initials } from "@/lib/utils";

export function UserMenu() {
  const session = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
      toast.error("Couldn't sign you out", {
        description: "Check your connection and try again.",
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex items-center gap-3 rounded-full py-1 pr-1 pl-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:pr-2"
      >
        <Avatar className="size-10">
          <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
            {initials(session.name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden leading-tight sm:block">
          <span className="block text-sm font-medium">{session.name}</span>
          <span className="block text-xs text-text-secondary">
            {roleLabels[session.role]}
          </span>
        </span>
        <ChevronDown className="hidden size-4 text-text-secondary sm:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
        <DropdownMenuLabel className="px-2 py-2">
          <span className="block text-sm font-medium text-foreground">{session.name}</span>
          <span className="block text-xs font-normal">{session.email}</span>
        </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} disabled={signingOut} variant="destructive">
          <LogOut aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
