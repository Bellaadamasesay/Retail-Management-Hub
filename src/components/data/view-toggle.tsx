"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "table" | "grid";

const options = [
  { value: "table", label: "Table view", Icon: List },
  { value: "grid", label: "Grid view", Icon: LayoutGrid },
] as const;

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Layout" className="inline-flex rounded-lg border bg-card p-0.5">
      {options.map(({ value: option, label, Icon }) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          aria-label={label}
          onClick={() => onChange(option)}
          className={cn(
            "grid size-9 place-items-center rounded-md text-text-secondary outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
            value === option ? "bg-primary text-primary-foreground" : "hover:bg-surface-hover",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
