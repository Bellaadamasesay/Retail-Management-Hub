"use client";

import { ArrowLeftRight, ClipboardCheck, PackagePlus, Receipt, Tag, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { useStaffName } from "@/features/users/api/use-users";
import { useAudit } from "@/features/audit/api/use-audit";
import type { AuditEntry } from "@/lib/api/types";
import { formatRelative } from "@/lib/format/date";
import { gsap, registerGsap, useGSAP } from "@/lib/motion/register";
import { duration, ease } from "@/lib/motion/tokens";
import { appNow } from "@/lib/time";
import { cn } from "@/lib/utils";
import { activityTitle, activityTone, type ActivityTone } from "../lib/metrics";

const toneClass: Record<ActivityTone, string> = {
  forest: "bg-kpi-forest-bg text-kpi-forest-fg",
  sage: "bg-kpi-sage-bg text-kpi-sage-fg",
  info: "bg-kpi-info-bg text-kpi-info-fg",
  clay: "bg-kpi-clay-bg text-kpi-clay-fg",
};

const icons: Record<AuditEntry["action"], LucideIcon> = {
  "sale.create": Receipt,
  "stock.intake": PackagePlus,
  "stock.adjust": PackagePlus,
  "stock.take.submit": ClipboardCheck,
  "stock.take.approve": ClipboardCheck,
  "stock.take.cancel": ClipboardCheck,
  "product.create": Tag,
  "product.price_change": Tag,
  "product.delete": Tag,
  "user.create": ArrowLeftRight,
  "user.update": ArrowLeftRight,
  "user.revoke": ArrowLeftRight,
  "user.restore": ArrowLeftRight,
  "user.reset_credentials": ArrowLeftRight,
  "settings.update": Tag,
};

/**
 * Live activity: the latest sales, stock and catalog changes. When something new
 * arrives it slides in at the top and its highlight fades out.
 */
export function ActivityFeed({ limit = 6 }: { limit?: number }) {
  const audit = useAudit();
  const staffName = useStaffName();
  const list = useRef<HTMLUListElement>(null);
  const known = useRef<Set<string> | null>(null);

  const entries = (audit.data ?? []).slice(0, limit);
  const ids = entries.map((e) => e.id).join("|");

  useGSAP(
    () => {
      registerGsap();
      if (entries.length === 0) return;
      if (known.current === null) {
        // First paint: remember what is already on screen, no animation.
        known.current = new Set(entries.map((e) => e.id));
        return;
      }
      const fresh = entries.filter((e) => !known.current!.has(e.id));
      for (const e of entries) known.current.add(e.id);
      if (fresh.length === 0) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        for (const e of fresh) {
          const row = list.current?.querySelector(`[data-id="${e.id}"]`);
          if (!row) continue;
          gsap.from(row, { y: -18, opacity: 0, duration: duration.base, ease: ease.enter });
          gsap.fromTo(row, { backgroundColor: "var(--primary-subtle)" }, { backgroundColor: "transparent", duration: 2.2, delay: 0.2 });
        }
      });
    },
    { scope: list, dependencies: [ids] },
  );

  if (audit.isPending) return <p className="py-6 text-sm text-text-secondary">Loading activity…</p>;
  if (entries.length === 0) return <p className="py-6 text-sm text-text-secondary">Nothing has happened yet today.</p>;

  return (
    <ul ref={list} aria-live="polite" aria-label="Recent activity" className="flex flex-col gap-1">
      {entries.map((entry) => {
        const Icon = icons[entry.action];
        return (
          <li key={entry.id} data-id={entry.id} className="flex items-start gap-3 rounded-lg px-1.5 py-2">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", toneClass[activityTone[entry.action]])}>
              <Icon className="size-[1.1rem]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{activityTitle[entry.action]}</span>
              <span className="block truncate text-xs text-text-secondary">
                {entry.action === "sale.create" ? (
                  <Link href="/sales" className="underline-offset-2 hover:underline">
                    {entry.entity}
                  </Link>
                ) : (
                  entry.entity
                )}{" "}
                · {entry.detail} · {staffName(entry.actorId)}
              </span>
            </span>
            <span className="shrink-0 text-xs text-text-secondary">{formatRelative(entry.at, appNow())}</span>
          </li>
        );
      })}
    </ul>
  );
}
