"use client";

import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format/date";
import { useShellStore } from "@/lib/stores/shell-store";
import { appNow } from "@/lib/time";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Today's date in the store's calendar as yyyy-mm-dd. */
function todayIso() {
  const now = appNow();
  return iso(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** Reference-date picker from the topbar. Dates after today can't be chosen. */
export function DatePicker() {
  const asOf = useShellStore((s) => s.asOf);
  const setAsOf = useShellStore((s) => s.setAsOf);
  const today = todayIso();
  const selected = asOf ?? today;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const [y, m] = selected.split("-").map(Number);
    return { year: y, month: m - 1 };
  });

  const firstWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const cells = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    setView(({ year, month }) => {
      const next = new Date(Date.UTC(year, month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  const atCurrentMonth = iso(view.year, view.month, 1) >= today.slice(0, 8) + "01";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-10 gap-2.5 px-3.5 font-normal" />
        }
        aria-label={`Reference date: ${formatDate(`${selected}T12:00:00Z`)}`}
      >
        <Calendar className="size-[1.1rem]" aria-hidden="true" />
        <span className="hidden sm:inline">{formatDate(`${selected}T12:00:00Z`)}</span>
        <ChevronDown className="size-4 text-text-secondary" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="mb-2 flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
            <ChevronLeft />
          </Button>
          <p className="text-sm font-medium" aria-live="polite">
            {MONTHS[view.month]} {view.year}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={atCurrentMonth}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-secondary">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <span key={`blank-${i}`} />;
            const value = iso(view.year, view.month, day);
            const future = value > today;
            const isSelected = value === selected;
            return (
              <button
                key={value}
                type="button"
                disabled={future}
                aria-pressed={isSelected}
                onClick={() => {
                  setAsOf(value === today ? null : value);
                  setOpen(false);
                }}
                className={cn(
                  "grid h-9 place-items-center rounded-lg text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected
                    ? "bg-primary font-medium text-primary-foreground"
                    : "hover:bg-surface-hover",
                  value === today && !isSelected && "ring-1 ring-primary",
                  future && "pointer-events-none opacity-35",
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAsOf(null);
              const [y, m] = today.split("-").map(Number);
              setView({ year: y, month: m - 1 });
              setOpen(false);
            }}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
