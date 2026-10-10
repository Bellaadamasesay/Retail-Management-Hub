/** A QR code's dark modules as rows of booleans, quiet zone included. */
export type QrModules = boolean[][];

/** Encodes each text as a QR code. The encoder loads on demand, so only pages that print labels pay for it. */
export async function encodeQr(texts: readonly string[]): Promise<Map<string, QrModules>> {
  const { BarcodeFormat, EncodeHintType, QRCodeWriter } = await import("@zxing/library");
  const writer = new QRCodeWriter();
  const hints = new Map<typeof EncodeHintType.MARGIN, number>([[EncodeHintType.MARGIN, 1]]);
  const result = new Map<string, QrModules>();
  for (const text of new Set(texts)) {
    // Width/height 0 asks for the natural size: one cell per module.
    const matrix = writer.encode(text, BarcodeFormat.QR_CODE, 0, 0, hints);
    result.set(
      text,
      Array.from({ length: matrix.getHeight() }, (_, y) => Array.from({ length: matrix.getWidth() }, (_, x) => matrix.get(x, y))),
    );
  }
  return result;
}

/** Crisp vector QR code: one path, so it prints sharp at any size. */
export function QrCode({ modules, size, label }: { modules: QrModules; size: string; label?: string }) {
  const n = modules.length;
  let d = "";
  modules.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)));
  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
