"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { switchTheme } from "@/lib/theme/switch-theme";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

const noopSubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // Avoid a hydration mismatch: the stored theme is only known on the client.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("inline-flex rounded-full border bg-card p-1", className)}
    >
      {options.map(({ value, label, Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => switchTheme(setTheme, value)}
            className={cn(
              "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              active && "bg-primary text-primary-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
