"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PrintPortalProps {
  /** Paper size for @page, e.g. "80mm auto" for receipts. */
  paper: string;
  children: ReactNode;
  /** Called after the print dialog closes (printed or cancelled). */
  onDone: () => void;
}

/**
 * Renders content outside the app, shows only it when printing (see the
 * `.print-root` rules in globals.css) and opens the print dialog once mounted.
 * Print output is always light, whatever the on-screen theme.
 */
export function PrintPortal({ paper, children, onDone }: PrintPortalProps) {
  useEffect(() => {
    const finish = () => onDone();
    window.addEventListener("afterprint", finish, { once: true });
    // Let the browser lay out the content before the dialog opens.
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", finish);
    };
  }, [onDone]);

  return createPortal(
    <div className="print-root" aria-hidden="true">
      <style>{`@page { size: ${paper}; margin: 0; }`}</style>
      {children}
    </div>,
    document.body,
  );
}
