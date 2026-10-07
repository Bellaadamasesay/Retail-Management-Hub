"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PrintPortal } from "@/components/print/print-portal";
import { Button } from "@/components/ui/button";
import type { Sale, StoreSettings } from "@/lib/api/types";
import { downloadReceiptPdf } from "@/lib/print/receipt-pdf";
import { Receipt } from "./receipt";

interface ReceiptActionsProps {
  sale: Sale;
  settings: StoreSettings | undefined;
  cashierName: string;
}

/** Print (80 mm receipt printer) and Download PDF, for a fresh sale or a reprint from history. */
export function ReceiptActions({ sale, settings, cashierName }: ReceiptActionsProps) {
  const [printing, setPrinting] = useState(false);
  return (
    <>
      <Button variant="outline" className="h-11" onClick={() => setPrinting(true)}>
        <Printer aria-hidden="true" /> Print
      </Button>
      <Button
        variant="outline"
        className="h-11"
        onClick={() =>
          downloadReceiptPdf(sale, settings, cashierName).catch(() =>
            toast.error("Couldn’t make the PDF", { description: "Try printing the receipt instead." }),
          )
        }
      >
        <Download aria-hidden="true" /> Download PDF
      </Button>
      {printing ? (
        <PrintPortal paper="80mm auto" onDone={() => setPrinting(false)}>
          <Receipt sale={sale} settings={settings} cashierName={cashierName} />
        </PrintPortal>
      ) : null}
    </>
  );
}
