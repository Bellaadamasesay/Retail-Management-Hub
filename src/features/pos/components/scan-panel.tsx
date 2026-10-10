"use client";

import type { IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, Check, ScanBarcode } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Money } from "@/components/data/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductPicture } from "@/features/catalog/components/product-picture";
import type { Product, Variant } from "@/lib/api/types";
import { variantColour, variantLabel } from "@/lib/inventory/stock";
import { cn } from "@/lib/utils";

export type ScanOutcome = "added" | "capped" | "sold-out" | "inactive";

interface Scanned {
  product: Product;
  variant: Variant;
  outcome: ScanOutcome;
}

interface ScanPanelProps {
  inputRef: RefObject<HTMLInputElement | null>;
  /** Exact label-code match only: cashiers scan what the customer brings, they don't browse the catalog. */
  lookup: (code: string) => { product: Product; variant: Variant } | null;
  onAdd: (product: Product, variant: Variant) => Promise<ScanOutcome>;
  onUnknown: (code: string) => void;
}

/**
 * A camera sees the same label on every frame while it's held up. A code
 * counts again only after it has been out of view this long, so holding an
 * item still adds it once; take it away and show it again to add another.
 */
const OUT_OF_VIEW_MS = 1000;

/**
 * Adds items to the cart by their label. Handheld scanners type the code and
 * press Enter into the code field (kept focused); the optional camera decodes
 * the QR labels printed from the catalog (and Code 128 / Code 39 barcodes)
 * carrying the variation's label code.
 */
export function ScanPanel({ inputRef, lookup, onAdd, onUnknown }: ScanPanelProps) {
  const [code, setCode] = useState("");
  const [last, setLast] = useState<Scanned | null>(null);
  const [camera, setCamera] = useState(false);

  function toggleCamera() {
    setCamera(!camera);
    inputRef.current?.focus();
  }

  async function scan(raw: string) {
    const value = raw.trim();
    if (!value) return;
    const hit = lookup(value);
    if (!hit) {
      beep(false);
      onUnknown(value);
      return;
    }
    const outcome = await onAdd(hit.product, hit.variant);
    beep(outcome === "added");
    setLast({ ...hit, outcome });
  }

  // The camera callback outlives renders; always call the latest scan().
  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current = scan;
  });

  return (
    <section aria-label="Scan items" className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Scan items</h2>
        <Button variant="outline" onClick={toggleCamera} aria-pressed={camera}>
          {camera ? <CameraOff aria-hidden="true" /> : <Camera aria-hidden="true" />}
          {camera ? "Stop camera" : "Use camera"}
        </Button>
      </div>

      {camera ? (
        <CameraView onCode={(text) => void scanRef.current(text)} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
          <ScanBarcode className="size-10 text-text-secondary" aria-hidden="true" />
          <p className="text-sm font-medium">Scan the label on each item</p>
          <p className="max-w-sm text-sm text-text-secondary">
            Use the handheld scanner, or turn on the camera and hold the QR code or barcode up to it.
          </p>
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void scan(code);
          setCode("");
        }}
      >
        <Input
          ref={inputRef}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setCode("")}
          placeholder="Code under the QR on the label, e.g. 100042"
          aria-label="Item code"
          autoComplete="off"
          spellCheck={false}
          className="h-11 flex-1 font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
        <Button type="submit" className="h-11 px-5" disabled={!code.trim()}>
          Add
        </Button>
      </form>

      {last ? (
        <div aria-live="polite" className="flex items-center gap-3 rounded-lg bg-surface-hover p-3">
          <ProductPicture product={last.product} colour={variantColour(last.variant)} className="size-14 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{last.product.name}</p>
            {variantLabel(last.variant) ? (
              <p className="truncate text-xs text-text-secondary">{variantLabel(last.variant)}</p>
            ) : null}
          </div>
          <div className="text-right">
            <Money amount={last.product.price} className="block text-sm font-semibold" />
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                last.outcome === "added" ? "text-kpi-sage-fg" : "font-medium text-destructive",
              )}
            >
              {last.outcome === "added" ? (
                <>
                  <Check className="size-3.5" aria-hidden="true" /> Added
                </>
              ) : last.outcome === "sold-out" ? (
                "Sold out"
              ) : last.outcome === "inactive" ? (
                "Not for sale"
              ) : (
                "Not added"
              )}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CameraView({ onCode }: { onCode: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let stopped = false;
    let lastText = "";
    let lastSeenAt = 0;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("The camera only works over a secure (https) connection. Use the handheld scanner instead.");
        return;
      }
      // Loaded on demand: only tills that turn the camera on pay for the decoder.
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);
      // Unmounted while loading (React dev mounts twice): don't grab the camera, or
      // this run's stop() would blank the shared <video> under the live run.
      if (stopped) return;
      const hints = new Map([
        [
          DecodeHintType.POSSIBLE_FORMATS,
          [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.DATA_MATRIX],
        ],
      ]);
      const reader = new BrowserMultiFormatReader(hints);
      try {
        const started = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current ?? undefined,
          (result) => {
            if (!result) return;
            const text = result.getText();
            const now = Date.now();
            const stillInView = text === lastText && now - lastSeenAt < OUT_OF_VIEW_MS;
            lastText = text;
            lastSeenAt = now;
            if (!stillInView) onCodeRef.current(text);
          },
        );
        if (stopped) started.stop();
        else controls = started;
      } catch (err) {
        if (stopped) return;
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in the browser’s site settings, or use the handheld scanner."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera found on this device. Use the handheld scanner instead."
              : "The camera couldn’t start. Close other apps using it, or use the handheld scanner.",
        );
      }
    }

    void start();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
        <CameraOff className="size-10 text-text-secondary" aria-hidden="true" />
        <p className="max-w-sm text-sm text-text-secondary">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
      <video ref={video} muted playsInline className="size-full object-cover" aria-label="Camera viewfinder" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-1/2 w-2/3 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
    </div>
  );
}

/** Short till beep: high for a good scan, low for a miss. Silent where audio is blocked. */
function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 1320 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
    osc.onended = () => void ctx.close();
  } catch {
    // No audio: the on-screen confirmation is enough.
  }
}
