"use client";

import { AlertCircle, CheckCircle2, Download, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import { downloadCsv } from "@/lib/csv";
import { useCreateProduct } from "../api/use-product-mutations";
import { useProducts } from "../api/use-products";
import {
  IMPORT_COLUMNS,
  parseProductImport,
  TEMPLATE_ROWS,
  type ImportPreview,
} from "../lib/import-products";

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Bulk-add products from a CSV file: download the template, fill it in, check the preview, import. */
export function ImportProductsDialog({ open, onOpenChange }: ImportProductsDialogProps) {
  const products = useProducts();
  const create = useCreateProduct();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);

  const valid = preview?.rows.filter((r) => r.input) ?? [];
  const invalid = preview?.rows.filter((r) => r.error) ?? [];

  function reset() {
    setFileName(null);
    setPreview(null);
    if (input.current) input.current.value = "";
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const catalog = products.data ?? [];
    setPreview(
      parseProductImport(text, {
        existingCodes: catalog.map((p) => p.code),
      }),
    );
  }

  async function runImport() {
    setImporting(true);
    let added = 0;
    try {
      for (const row of valid) {
        await create.mutateAsync(row.input!);
        added += 1;
      }
      toast.success(`Imported ${added} ${added === 1 ? "product" : "products"}`, {
        description: "They’re in the catalog with stock at zero, ready for the next intake.",
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(added > 0 ? `Stopped after ${added} of ${valid.length}` : "Import failed", {
        description: error instanceof ApiError ? error.message : "Check your connection and try again.",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Import Products</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Upload a CSV with one product per line. Colours and sizes are expanded into variants,
            and SKUs are created for you. Prices are in Leones. New products start
            with no stock; record it through Stock Intake.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => downloadCsv("retailhub-products-template.csv", TEMPLATE_ROWS)}>
            <Download aria-hidden="true" /> Download template
          </Button>
          <Button onClick={() => input.current?.click()}>
            <FileUp aria-hidden="true" /> {fileName ? "Choose a different file" : "Choose CSV file"}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="CSV file"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {fileName ? <span className="text-sm text-text-secondary">{fileName}</span> : null}
        </div>

        <p className="text-xs text-text-secondary">
          Columns: <span className="font-mono">{IMPORT_COLUMNS.join(", ")}</span>. Separate colours
          with <span className="font-mono">|</span> (Black|Tan). Sizes can be a range (36-45), a
          list (S|M|L) or One size.
        </p>

        {preview?.missingColumns.length ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            The file is missing these columns: {preview.missingColumns.join(", ")}. Download the template to see the layout.
          </p>
        ) : null}

        {preview && preview.rows.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm" role="status">
              <span className="font-medium text-success">{valid.length} ready</span>
              {invalid.length > 0 ? (
                <span className="font-medium text-destructive">, {invalid.length} need fixing</span>
              ) : null}
            </p>
            <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
              {preview.rows.map((row) => (
                <li key={row.line} className="flex items-start gap-2.5 px-3 py-2 text-sm">
                  {row.error ? (
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Problem" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Ready" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      Line {row.line}: {row.name}
                    </span>
                    <span className="block text-xs text-text-secondary">
                      {row.error ??
                        `${row.input!.variants.length} variants · code ${row.input!.code}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : preview && !preview.missingColumns.length ? (
          <p className="text-sm text-text-secondary">That file has no product lines.</p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={valid.length === 0 || importing} onClick={runImport}>
            {importing
              ? "Importing…"
              : valid.length > 0
                ? `Import ${valid.length} ${valid.length === 1 ? "product" : "products"}`
                : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
