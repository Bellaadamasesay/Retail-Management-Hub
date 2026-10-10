"use client";

import { Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PrintPortal } from "@/components/print/print-portal";
import { encodeQr, QrCode, type QrModules } from "@/components/print/qr-code";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/api/types";
import { formatMoney } from "@/lib/format/money";
import { variantLabel } from "@/lib/inventory/stock";

interface PrintLabelsDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start with labels for this variation only (the others at zero). */
  only?: string;
}

/**
 * QR stickers for the till: one per item, carrying the variation's label code.
 * Copies default to what's on the shelf. Prints on A4 as a grid of cut-out labels.
 */
export function PrintLabelsDialog({ product, open, onOpenChange, only }: PrintLabelsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so the copies start fresh from current stock each time. */}
        {open ? <LabelsForm product={product} only={only} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

interface Sheet {
  labels: { key: string; name: string; label: string; price: string; code: string }[];
  qr: Map<string, QrModules>;
}

function LabelsForm({ product, only, onDone }: { product: Product; only?: string; onDone: () => void }) {
  const [copies, setCopies] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.variants.map((v) => [v.id, String(only && v.id !== only ? 0 : Math.max(v.stock, only ? 1 : 0))])),
  );
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [preparing, setPreparing] = useState(false);

  const count = (id: string) => (/^\d+$/.test(copies[id] ?? "") ? Math.min(Number(copies[id]), 500) : 0);
  const total = product.variants.reduce((n, v) => n + count(v.id), 0);
  const single = product.optionTypes.length === 0;

  async function print() {
    setPreparing(true);
    try {
      const labels = product.variants.flatMap((v) =>
        Array.from({ length: count(v.id) }, (_, i) => ({
          key: `${v.id}-${i}`,
          name: product.name,
          label: variantLabel(v),
          price: formatMoney(product.price),
          code: v.code,
        })),
      );
      setSheet({ labels, qr: await encodeQr(labels.map((l) => l.code)) });
    } catch {
      toast.error("We couldn’t prepare the labels", { description: "Reload the page and try again." });
    } finally {
      setPreparing(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-xl">Print labels</DialogTitle>
        <DialogDescription>
          One QR sticker per item for {product.name}. The till scans it to add the right {single ? "item" : "variation"}.
        </DialogDescription>
      </DialogHeader>

      <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border">
        {product.variants.map((v) => (
          <li key={v.id} className="flex items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{variantLabel(v) || product.name}</span>
              <span className="block text-xs text-text-secondary">{v.stock} in stock</span>
            </span>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              Labels
              <Input
                inputMode="numeric"
                value={copies[v.id]}
                onChange={(e) => setCopies((c) => ({ ...c, [v.id]: e.target.value.replace(/\D/g, "") }))}
                aria-label={`Labels for ${variantLabel(v) || product.name}`}
                className="h-9 w-20 text-right tabular"
              />
            </label>
          </li>
        ))}
      </ul>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => void print()} disabled={total === 0 || preparing}>
          {preparing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Printer aria-hidden="true" />}
          Print {total} {total === 1 ? "label" : "labels"}
        </Button>
      </DialogFooter>

      {sheet ? (
        <PrintPortal paper="A4" onDone={() => setSheet(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 48mm)", gridAutoRows: "26mm", gap: "2mm", padding: "8mm" }}>
            {sheet.labels.map((l) => (
              <div
                key={l.key}
                style={{ display: "flex", alignItems: "center", gap: "2mm", padding: "1.5mm", border: "0.2mm dashed #bbb", breakInside: "avoid", overflow: "hidden", fontFamily: "sans-serif" }}
              >
                <QrCode modules={sheet.qr.get(l.code)!} size="21mm" />
                <div style={{ minWidth: 0, lineHeight: 1.2 }}>
                  <div style={{ fontSize: "7.5pt", fontWeight: 700, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{l.name}</div>
                  {l.label ? <div style={{ fontSize: "7pt" }}>{l.label}</div> : null}
                  <div style={{ fontSize: "8pt", fontWeight: 700, marginTop: "1mm" }}>{l.price}</div>
                  <div style={{ fontSize: "6.5pt", fontFamily: "monospace", color: "#444" }}>{l.code}</div>
                </div>
              </div>
            ))}
          </div>
        </PrintPortal>
      ) : null}
    </>
  );
}
