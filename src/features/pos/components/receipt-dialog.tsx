"use client";

import { Plus } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStaffName } from "@/features/users/api/use-users";
import type { Sale, StoreSettings } from "@/lib/api/types";
import { formatMoney } from "@/lib/format/money";
import { gsap, registerGsap, useGSAP } from "@/lib/motion/register";
import { duration, ease, REDUCED_MOTION_QUERY } from "@/lib/motion/tokens";
import { Receipt } from "./receipt";
import { ReceiptActions } from "./receipt-actions";

interface ReceiptDialogProps {
  sale: Sale | null;
  settings: StoreSettings | undefined;
  onNewSale: () => void;
}

/** "Nice sale!": a drawn check mark, a little confetti, and the receipt sliding out like it's printing. */
export function ReceiptDialog({ sale, settings, onNewSale }: ReceiptDialogProps) {
  const staffName = useStaffName();

  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && onNewSale()}>
      <DialogContent className="max-h-[94dvh] gap-4 overflow-y-auto sm:max-w-md" showCloseButton={false}>
        {sale ? (
          <>
            <Celebration />
            <div className="text-center">
              <DialogTitle className="font-display text-2xl font-bold">Nice sale! Receipt is ready</DialogTitle>
              <DialogDescription className="mt-1">
                {sale.receiptNumber} · {formatMoney(sale.total)} paid in cash
                {sale.payment.change > 0 ? ` · ${formatMoney(sale.payment.change)} change` : ""}
              </DialogDescription>
            </div>
            <SlideOut>
              <Receipt
                sale={sale}
                settings={settings}
                cashierName={staffName(sale.cashierId)}
                className="mx-auto rounded-sm shadow-lifted ring-1 ring-black/10"
              />
            </SlideOut>
            <div className="grid grid-cols-2 gap-2">
              <ReceiptActions sale={sale} settings={settings} cashierName={staffName(sale.cashierId)} />
              <Button className="col-span-2 h-12 text-base" onClick={onNewSale} autoFocus>
                <Plus aria-hidden="true" /> New sale
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** A check mark that draws itself inside a ring, then a short burst of confetti. */
function Celebration() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      registerGsap();
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline();
        tl.from("[data-ring]", { scale: 0.6, opacity: 0, duration: duration.fast, ease: ease.playful })
          .fromTo("[data-check]", { strokeDashoffset: 30 }, { strokeDashoffset: 0, duration: duration.base, ease: ease.enter }, "<0.05")
          .fromTo(
            "[data-confetti]",
            { x: 0, y: 0, opacity: 1, scale: 1 },
            {
              x: () => gsap.utils.random(-120, 120),
              y: () => gsap.utils.random(-90, 40),
              rotate: () => gsap.utils.random(-200, 200),
              opacity: 0,
              scale: 0.6,
              duration: duration.slow,
              ease: "power2.out",
              stagger: 0.012,
            },
            "<0.1",
          );
      });
      mm.add(REDUCED_MOTION_QUERY, () => {
        gsap.set("[data-check]", { strokeDashoffset: 0 });
        gsap.set("[data-confetti]", { opacity: 0 });
      });
    },
    { scope: root },
  );

  const colours = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
  return (
    <div ref={root} className="relative mx-auto grid size-16 place-items-center" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} data-confetti className={`absolute size-2 rounded-[2px] ${colours[i % colours.length]}`} />
      ))}
      <svg viewBox="0 0 64 64" className="relative size-16">
        <circle data-ring cx="32" cy="32" r="29" className="fill-success/15 stroke-success" strokeWidth="3" />
        <path
          data-check
          d="M20 33l9 9 16-18"
          fill="none"
          className="stroke-success"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="30"
          strokeDashoffset="0"
        />
      </svg>
    </div>
  );
}

/** The receipt rises into view as if from a printer slot. Reduced motion: it is simply there. */
function SlideOut({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      registerGsap();
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ref.current, { y: 48, opacity: 0, duration: duration.base, delay: 0.25, ease: ease.enter, clearProps: "transform,opacity" });
      });
    },
    { scope: ref },
  );
  return <div ref={ref}>{children}</div>;
}
