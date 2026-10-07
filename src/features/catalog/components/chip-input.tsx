"use client";

import { Lock, Plus, X } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ChipInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** One-tap additions shown under the field. */
  suggestions?: readonly string[];
  /** Values that can't be removed (e.g. variants that still hold stock), with the reason. */
  locked?: Record<string, string>;
  disabled?: boolean;
  error?: string;
  hint?: string;
}

/** Type a value and press Enter or comma to add it; click a chip's x to remove it. */
export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  suggestions = [],
  locked = {},
  disabled,
  error,
  hint,
}: ChipInputProps) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) return;
    const exists = values.some((v) => v.toLowerCase() === value.toLowerCase());
    if (!exists) onChange([...values, value]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      const last = values[values.length - 1];
      if (!locked[last]) onChange(values.slice(0, -1));
    }
  }

  const remaining = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-input-background px-2 py-1.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/40",
          error && "border-destructive",
          disabled && "opacity-60",
        )}
      >
        {values.map((value) => {
          const reason = locked[value];
          return (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-md bg-primary-subtle py-1 pr-1 pl-2.5 text-sm text-accent-foreground"
            >
              {value}
              {reason ? (
                <span title={reason} className="grid size-5 place-items-center text-text-secondary">
                  <Lock className="size-3" aria-label={reason} />
                </span>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${value}`}
                  onClick={() => onChange(values.filter((v) => v !== value))}
                  className="grid size-5 place-items-center rounded text-text-secondary outline-none hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          );
        })}
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={values.length === 0 ? placeholder : "Add another…"}
          aria-invalid={Boolean(error)}
          className="h-7 min-w-28 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-secondary">{hint}</p>
      ) : null}
      {remaining.length > 0 && !disabled ? (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-text-secondary outline-none hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" aria-hidden="true" />
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
