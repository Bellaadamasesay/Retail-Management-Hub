import type { Variant, VariantInput } from "@/lib/api/types";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

/** Size sets offered in the product form. */
export const SIZE_PRESETS = [
  { label: "Shoe sizes 36–45", sizes: range(36, 45) },
  { label: "Belt sizes S, M, L", sizes: ["S", "M", "L"] },
  { label: "One size", sizes: ["One size"] },
] as const;

export const ONE_SIZE = "One size";

const alnum = (text: string) => text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/**
 * Short code per colour for SKUs: the first three letters, lengthened (or
 * numbered) only when two colours of the same product would collide, e.g.
 * "Black" and "Blush" stay BLA / BLU, but "Navy" and "Navy Blue" become NAV / NAVY.
 */
export function colourCodes(colours: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  const taken = new Set<string>();
  for (const colour of colours) {
    const letters = alnum(colour) || "COL";
    let length = 3;
    let code = letters.slice(0, length).padEnd(3, "X");
    while (taken.has(code) && length < letters.length) {
      length += 1;
      code = letters.slice(0, length);
    }
    let n = 2;
    const base = code;
    while (taken.has(code)) code = `${base}${n++}`;
    taken.add(code);
    result.set(colour, code);
  }
  return result;
}

export const sizeCode = (size: string) => (size === ONE_SIZE ? "OS" : alnum(size));

export function buildSku(productCode: string, colourCode: string, size: string) {
  return `${productCode}-${colourCode}-${sizeCode(size)}`;
}

/** "Leather Tote Bag" -> "LTB"; a single word uses its first three letters. Made unique against `taken`. */
export function deriveProductCode(name: string, taken: readonly string[] = []): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let code =
    words.length > 1
      ? words.map((w) => alnum(w)[0] ?? "").join("")
      : alnum(words[0] ?? "").slice(0, 3);
  code = code.slice(0, 6).padEnd(2, "X");
  const base = code.slice(0, 5);
  let n = 2;
  while (taken.includes(code)) code = `${base}${n++}`.slice(0, 6);
  return code;
}

interface GenerateOptions {
  productCode: string;
  colours: readonly string[];
  sizes: readonly string[];
  reorderThreshold: number;
  /** Variants already saved on this product: kept as they are (same id and SKU). */
  existing?: readonly Variant[];
}

/**
 * Builds the colour x size grid. Combinations that already exist keep their
 * identity; new ones get a SKU. Combinations that were dropped simply don't
 * appear in the result.
 */
export function generateVariants({
  productCode,
  colours,
  sizes,
  reorderThreshold,
  existing = [],
}: GenerateOptions): VariantInput[] {
  const codes = colourCodes(colours);
  const result: VariantInput[] = [];

  for (const colour of colours) {
    for (const size of sizes) {
      const kept = existing.find((v) => v.colour === colour && v.size === size);
      const variant: VariantInput = kept
        ? {
            id: kept.id,
            sku: kept.sku,
            colour,
            size,
            reorderThreshold: kept.reorderThreshold,
          }
        : {
            sku: buildSku(productCode, codes.get(colour)!, size),
            colour,
            size,
            reorderThreshold,
          };
      result.push(variant);
    }
  }

  return result;
}
