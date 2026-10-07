import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Buttons, tabs or filters aligned to the right of the title. */
  actions?: ReactNode;
  className?: string;
}

/** Serif page title with a supporting line and optional actions, as on every approved screen. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-[2rem] leading-tight font-bold">{title}</h1>
        {description ? (
          <p className="mt-2 text-[0.9375rem] text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
