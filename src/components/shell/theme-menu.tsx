"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchTheme } from "@/lib/theme/switch-theme";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** Round sun/moon button from the topbar; opens Light / Dark / System. */
export function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";
  const Icon = dark ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change colour theme"
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          dark
            ? "bg-sidebar-accent text-foreground hover:bg-sidebar-hover"
            : "bg-kpi-ochre-bg text-kpi-ochre-fg hover:bg-kpi-ochre-bg/70",
        )}
      >
        <Icon className="size-[1.15rem]" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={mounted ? theme : undefined}
          onValueChange={(value) => switchTheme(setTheme, String(value))}
        >
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden="true" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden="true" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
