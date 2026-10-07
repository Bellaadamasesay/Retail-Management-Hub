"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface HelpDialogProps {
  /** The link-styled trigger text. */
  trigger: ReactNode;
  title: string;
  children: ReactNode;
}

/**
 * Staff accounts are managed by a Super Admin (PRD: create accounts, reset
 * PINs/passwords, revoke access), so "forgot password" and "contact support"
 * both explain that path rather than offering self-service reset.
 */
export function HelpDialog({ trigger, title, children }: HelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger className="font-medium text-primary underline underline-offset-2 outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50">
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-text-secondary">
            {children}
          </DialogDescription>
        </DialogHeader>
        <DialogClose render={<Button className="w-full" />}>Got it</DialogClose>
      </DialogContent>
    </Dialog>
  );
}
