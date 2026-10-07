"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "@/lib/auth/session-context";
import { gsap, registerGsap, useGSAP } from "@/lib/motion/register";
import { duration, ease, REDUCED_MOTION_QUERY } from "@/lib/motion/tokens";
import { activeNavHref, navFor } from "@/lib/rbac/routes";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  collapsed?: boolean;
  /** Called after a link is chosen (closes the mobile drawer). */
  onNavigate?: () => void;
}

/** Role-aware navigation. The active pill slides between items. */
export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { role } = useSession();
  const pathname = usePathname();
  const items = navFor(role);
  const active = activeNavHref(pathname);

  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useGSAP(
    () => {
      registerGsap();
      const target = nav.current?.querySelector<HTMLElement>(
        `[data-href="${active}"]`,
      );
      if (!target || !pill.current) {
        if (pill.current) gsap.set(pill.current, { opacity: 0 });
        return;
      }
      const to = { y: target.offsetTop, height: target.offsetHeight, opacity: 1 };
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (placed.current) {
          gsap.to(pill.current, { ...to, duration: duration.base, ease: ease.move });
        } else {
          gsap.set(pill.current, to);
        }
      });
      mm.add(REDUCED_MOTION_QUERY, () => {
        gsap.set(pill.current, to);
      });
      placed.current = true;
    },
    { scope: nav, dependencies: [active, collapsed, items.length] },
  );

  return (
    <nav ref={nav} aria-label="Main" className="relative flex flex-col gap-1">
      <span
        ref={pill}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 rounded-lg bg-sidebar-accent opacity-0"
      >
        <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary" />
      </span>
      {items.map((item, index) => {
        const isActive = item.href === active;
        const heading = item.group && item.group !== items[index - 1]?.group ? item.group : null;
        const link = (
          <Link
            key={item.href}
            href={item.href}
            data-href={item.href}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "relative z-10 flex h-10 items-center gap-3 rounded-lg px-3 text-[0.9375rem] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
              isActive
                ? "font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-hover",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon className="size-5 shrink-0" aria-hidden="true" />
            <span className={cn(collapsed && "sr-only")}>{item.label}</span>
          </Link>
        );
        const node = collapsed ? (
          <Tooltip key={item.href}>
            <TooltipTrigger render={link} />
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          link
        );
        return heading ? (
          <div key={item.href} className="contents">
            {collapsed ? (
              <span aria-hidden="true" className="mx-3 mt-3 mb-1 h-px bg-sidebar-border" />
            ) : (
              <p className="mt-5 mb-1 px-3 text-[0.6875rem] font-semibold tracking-[0.08em] text-text-muted uppercase">{heading}</p>
            )}
            {node}
          </div>
        ) : (
          node
        );
      })}
    </nav>
  );
}
