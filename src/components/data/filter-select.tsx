"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly FilterOption[];
  /** Accessible name, e.g. "Category". */
  label: string;
  className?: string;
}

/** The "All Categories" / "All Statuses" style dropdowns used in filter bars. */
export function FilterSelect({ value, onChange, options, label, className }: FilterSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(String(next))}
      items={options as FilterOption[]}
    >
      <SelectTrigger aria-label={label} className={cn("h-10 min-w-40", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="min-w-44">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
