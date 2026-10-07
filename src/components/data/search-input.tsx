"use client";

import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Search field with a leading magnifier, as in every filter bar. */
export function SearchInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-[1.05rem] -translate-y-1/2 text-text-secondary"
        aria-hidden="true"
      />
      <Input type="search" className="h-10 pl-10 [&::-webkit-search-cancel-button]:hidden" {...props} />
    </div>
  );
}
