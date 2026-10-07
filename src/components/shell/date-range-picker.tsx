"use client";

import { Calendar, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays } from "@/features/sales/lib/sales";
import { formatDate } from "@/lib/format/date";

export type DayRange = { from: string; to: string };

interface DateRangePickerProps {
  value: DayRange;
  onChange: (range: DayRange) => void;
  /** The last day that can be chosen (today). */
  max: string;
}

const noon = (day: string) => `${day}T12:00:00Z`;

/** "Mar 4, 2024 - Mar 10, 2024" button with quick presets and exact dates. */
export function DateRangePicker({ value, onChange, max }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);

  const presets: { label: string; range: DayRange }[] = [
    { label: "Today", range: { from: max, to: max } },
    { label: "Last 7 days", range: { from: addDays(max, -6), to: max } },
    { label: "Last 30 days", range: { from: addDays(max, -29), to: max } },
    { label: "This month", range: { from: `${max.slice(0, 8)}01`, to: max } },
  ];

  const valid = from !== "" && to !== "" && from <= to && to <= max;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setFrom(value.from);
          setTo(value.to);
        }
      }}
    >
      <PopoverTrigger
        render={<Button variant="outline" className="h-10 gap-2.5 px-3.5 font-normal" />}
        aria-label={`Date range: ${formatDate(noon(value.from))} to ${formatDate(noon(value.to))}`}
      >
        <Calendar className="size-[1.1rem]" aria-hidden="true" />
        <span>
          {formatDate(noon(value.from))}
          {value.from === value.to ? "" : ` - ${formatDate(noon(value.to))}`}
        </span>
        <ChevronDown className="size-4 text-text-secondary" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(p.range);
                setOpen(false);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="range-from" className="text-xs font-semibold">
              From
            </Label>
            <Input id="range-from" type="date" value={from} max={max} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="range-to" className="text-xs font-semibold">
              To
            </Label>
            <Input id="range-to" type="date" value={to} max={max} onChange={(e) => setTo(e.target.value)} className="h-9" />
          </div>
        </div>
        {!valid && from !== "" && to !== "" ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {from > to ? "The start date must be before the end date." : "Dates after today can’t be chosen."}
          </p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!valid}
            onClick={() => {
              onChange({ from, to });
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
