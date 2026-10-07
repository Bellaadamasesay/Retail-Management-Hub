import { cn } from "@/lib/utils";

/** Two overlapping leaf shapes: the RetailHub mark. Colours come from tokens so it works in both themes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 46"
      aria-hidden="true"
      className={cn("h-9 w-8 shrink-0", className)}
    >
      <rect x="1" y="1" width="23" height="29" rx="10" className="fill-primary" />
      <rect
        x="15"
        y="14"
        width="24"
        height="31"
        rx="10"
        className="fill-kpi-sage-fg stroke-card"
        strokeWidth="2"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** Hide the "Retail Management System" line (collapsed sidebar). */
  compact?: boolean;
  /** "lg" is the larger lock-up used on the sign-in screen. */
  size?: "md" | "lg";
}

export function Logo({ className, compact = false, size = "md" }: LogoProps) {
  const large = size === "lg";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={large ? "h-11 w-10" : undefined} />
      {compact ? null : (
        <div className="leading-none">
          <p className={cn(
              "font-display font-bold tracking-tight text-foreground",
              large ? "text-[1.65rem]" : "text-xl",
            )}>
            RetailHub
          </p>
          <p className={cn("mt-1 text-text-secondary", large ? "text-xs" : "text-[0.65rem]")}>
            Retail Management System
          </p>
        </div>
      )}
    </div>
  );
}
