"use client";

import { Camera, CameraOff, ImageUp, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Photos are stored square and small: plenty for a catalog tile, light enough to keep many of. */
const SIDE = 640;
const QUALITY = 0.8;

/** Centre-crops any image source to a square JPEG data URL. */
function toSquareJpeg(source: CanvasImageSource, width: number, height: number): string {
  const crop = Math.min(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  canvas.getContext("2d")!.drawImage(source, (width - crop) / 2, (height - crop) / 2, crop, crop, 0, 0, SIDE, SIDE);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (dataUrl: string) => void;
}

/** Live camera with a shutter: snap, check, then use or retake. Falls back to picking a photo when there's no camera. */
export function CameraCapture({ open, onOpenChange, onCapture }: CameraCaptureProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Product photo</DialogTitle>
          <DialogDescription>Place the product in the square on a plain background, then snap.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the camera turns off as soon as the dialog closes. */}
        {open ? (
          <Shutter
            onUse={(url) => {
              onCapture(url);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Shutter({ onUse }: { onUse: (dataUrl: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("The camera only works over a secure (https) connection.");
        return;
      }
      try {
        const live = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        // Closed while the browser was asking (or React dev's double mount): let this stream go.
        if (stopped) {
          live.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = live;
        if (video.current) {
          video.current.srcObject = live;
          await video.current.play().catch(() => {});
        }
      } catch (err) {
        if (stopped) return;
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in the browser’s site settings, or choose a photo instead."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera found on this device."
              : "The camera couldn’t start. Close other apps using it, or choose a photo instead.",
        );
      }
    }

    void start();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setShot(toSquareJpeg(v, v.videoWidth, v.videoHeight));
  }

  async function fromFile(picked: File | undefined) {
    if (!picked) return;
    try {
      const bitmap = await createImageBitmap(picked);
      setShot(toSquareJpeg(bitmap, bitmap.width, bitmap.height));
      bitmap.close();
    } catch {
      setError("That file isn’t a photo we can read. Try a JPEG or PNG.");
    }
  }

  return (
    <>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-black">
        {error ? (
          <div role="alert" className="grid size-full place-items-center p-6 text-center">
            <div className="flex flex-col items-center gap-2 text-white/80">
              <CameraOff className="size-10" aria-hidden="true" />
              <p className="max-w-xs text-sm">{error}</p>
            </div>
          </div>
        ) : (
          // Stays mounted under the snapshot so "Retake" goes straight back to the live picture.
          <video
            ref={video}
            muted
            playsInline
            onLoadedData={() => setReady(true)}
            aria-label="Camera viewfinder"
            className="size-full object-cover"
          />
        )}
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing to optimise
          <img src={shot} alt="The photo you just took" className="absolute inset-0 size-full object-cover" />
        ) : null}
      </div>

      <input
        ref={file}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Choose a photo"
        onChange={(e) => void fromFile(e.target.files?.[0])}
      />

      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" onClick={() => file.current?.click()}>
          <ImageUp aria-hidden="true" /> Choose a photo instead
        </Button>
        {shot ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShot(null)} disabled={Boolean(error)}>
              <RotateCcw aria-hidden="true" /> Retake
            </Button>
            <Button onClick={() => onUse(shot)}>Use photo</Button>
          </div>
        ) : (
          <Button onClick={snap} disabled={!ready || Boolean(error)} className="min-w-28">
            <Camera aria-hidden="true" /> Snap
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
