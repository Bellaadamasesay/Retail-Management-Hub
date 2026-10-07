import type { HTMLAttributes, ReactNode } from "react";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Illustrated product pictures on the palette's warm product background.
 * Until real photography is supplied, every product gets a clean flat
 * illustration of its shape, tinted with the colour of the variant shown.
 */

/** Real-world colour names used by the catalog. These tint product art only, never the UI. */
const COLOUR_FILL: Record<string, string> = {
  Black: "#2d2d2a",
  White: "#f2efe8",
  Cream: "#ece3cd",
  Tan: "#b9824f",
  Brown: "#7b4b2c",
  Cognac: "#a85b2d",
  Sand: "#d8c3a0",
  Charcoal: "#474b4d",
  Navy: "#2c3c58",
  Nude: "#d8b39a",
  Olive: "#5d6142",
  Gold: "#c9a34a",
  Blush: "#e4b8ae",
  Grey: "#8b9093",
  Burgundy: "#6b2336",
  Floral: "#c46f6a",
  Stripe: "#476b87",
};

const FALLBACK_FILL = "#9a8670";

/** Colour names the product form offers as one-tap suggestions. */
export const KNOWN_COLOURS = Object.keys(COLOUR_FILL);

export type ProductShape =
  | "tote" | "satchel" | "duffel" | "clutch" | "backpack"
  | "sneaker" | "oxford" | "boot" | "heel" | "sandal"
  | "belt" | "cardholder" | "scarf";

const SHAPE_BY_CODE: Record<string, ProductShape> = {
  OXB: "oxford", SCB: "boot", ELS: "sneaker", SBH: "heel", CSO: "sneaker", LSD: "sandal",
  LTB: "tote", CBS: "satchel", WKD: "duffel", MCL: "clutch", CBP: "backpack",
  BLT: "belt", CRH: "cardholder", SSC: "scarf",
};

const SHAPE_BY_CATEGORY: Record<Category, ProductShape> = {
  Shoes: "sneaker",
  Bags: "tote",
  Accessories: "belt",
};

export function shapeFor(code: string, category: Category): ProductShape {
  return SHAPE_BY_CODE[code] ?? SHAPE_BY_CATEGORY[category];
}

function art(shape: ProductShape, c: string): ReactNode {
  const stroke = { stroke: "#000", strokeOpacity: 0.35, strokeLinecap: "round" as const, fill: "none" };
  const shade = { fill: "#000", fillOpacity: 0.16 };
  const light = { fill: "#fff", fillOpacity: 0.28 };
  switch (shape) {
    case "tote":
      return (
        <>
          <path d="M23 30c0-15 18-15 18 0" {...stroke} strokeWidth="3" />
          <path d="M13 29h38l-3 26H16z" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M13 29h38l-.5 5h-37z" {...shade} />
          <path d="M20 38h6v14h-6z" {...light} />
        </>
      );
    case "satchel":
      return (
        <>
          <path d="M19 28C19 6 45 6 45 28" {...stroke} strokeWidth="2.5" />
          <rect x="12" y="26" width="40" height="26" rx="4" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M12 30a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v3l-20 8-20-8z" {...shade} />
          <circle cx="32" cy="40" r="2.6" fill="#d4b25a" />
        </>
      );
    case "duffel":
      return (
        <>
          <path d="M20 29c0-12 24-12 24 0" {...stroke} strokeWidth="3" />
          <rect x="6" y="28" width="52" height="24" rx="12" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M10 38h44" {...stroke} strokeWidth="1.5" strokeDasharray="2 2" />
          <rect x="6" y="28" width="52" height="8" rx="4" {...light} />
        </>
      );
    case "clutch":
      return (
        <>
          <path d="M12 28C18 8 46 8 52 28" stroke="#d4b25a" strokeWidth="1.6" fill="none" />
          <rect x="9" y="28" width="46" height="24" rx="5" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M9 33a5 5 0 0 1 5-5h36a5 5 0 0 1 5 5v1l-23 9-23-9z" {...shade} />
          <circle cx="32" cy="41" r="2.4" fill="#d4b25a" />
        </>
      );
    case "backpack":
      return (
        <>
          <path d="M26 15c0-6 12-6 12 0" {...stroke} strokeWidth="2.5" />
          <rect x="14" y="14" width="36" height="42" rx="13" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <rect x="20" y="36" width="24" height="15" rx="5" {...shade} />
          <path d="M20 26h24" {...stroke} strokeWidth="1.6" />
        </>
      );
    case "belt":
      return (
        <>
          <rect x="4" y="27" width="56" height="10" rx="2.5" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <rect x="4" y="27" width="56" height="3.5" rx="1.5" {...light} />
          <rect x="22" y="22" width="16" height="20" rx="3" fill="none" stroke="#d4b25a" strokeWidth="3" />
          {[44, 49, 54].map((x) => (
            <circle key={x} cx={x} cy="32" r="1.2" fill="#000" fillOpacity="0.35" />
          ))}
        </>
      );
    case "cardholder":
      return (
        <>
          <rect x="20" y="14" width="26" height="16" rx="2.5" fill="#fff" fillOpacity="0.85" />
          <rect x="13" y="22" width="38" height="28" rx="5" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M13 32h38" {...stroke} strokeWidth="1.5" />
          <rect x="13" y="22" width="38" height="8" rx="4" {...shade} />
        </>
      );
    case "scarf":
      return (
        <>
          <path d="M10 18c10-6 18 6 28 0s14-4 16 0l-4 30c-10 6-18-6-28 0s-14 4-16 0z" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M10 18c10-6 18 6 28 0s14-4 16 0l-1 8c-8 3-16-6-26 0s-14 3-18 0z" {...light} />
          <path d="M16 22l-4 26M26 26l-4 26M36 24l-4 26M46 24l-4 26" {...stroke} strokeWidth="1" strokeOpacity="0.18" />
        </>
      );
    case "sneaker":
      return (
        <>
          <path d="M6 44v-9c0-3 3-5 6-4l8 3c4-4 10-4 14 0l12 6c6 2 10 4 10 8v2z" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M6 44h52v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill="#f2efe8" />
          <path d="M6 47h52" {...stroke} strokeWidth="1" strokeOpacity="0.2" />
          <path d="M22 34l5 3M27 31l5 3M32 30l5 3" {...stroke} strokeWidth="1.6" strokeOpacity="0.4" />
        </>
      );
    case "oxford":
      return (
        <>
          <path d="M6 44v-9c0-3 3-5 6-4l9 3c5-3 9-3 14 0l11 5c6 2 12 3 12 8v2z" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M6 44h52v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="#2a1d14" />
          <rect x="6" y="48" width="14" height="5" rx="1.5" fill="#2a1d14" />
          <path d="M24 33l4 3M29 31l4 3M34 31l4 3" {...stroke} strokeWidth="1.5" strokeOpacity="0.45" />
          <path d="M44 40c4 0 8 1 11 3" {...stroke} strokeWidth="1.2" strokeOpacity="0.3" />
        </>
      );
    case "boot":
      return (
        <>
          <path d="M16 8h18v24l14 6c6 2 10 4 10 8v2H10V10z" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M16 30h18v6H16z" {...shade} />
          <path d="M10 46h50v5a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="#3a2a1d" />
          <rect x="14" y="8" width="5" height="6" rx="1" fill="#2a1d14" fillOpacity="0.5" />
        </>
      );
    case "heel":
      return (
        <>
          <path d="M10 34c0-4 5-6 9-3l9 6 18-2c5-1 9 2 9 6v4H10z" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <path d="M10 44h46l-6 3H34l-1 6H26l1-6H10z" fill="#3a2a1d" fillOpacity="0.85" />
          <path d="M44 36c3-7 8-9 11-8" {...stroke} strokeWidth="2.6" />
          <rect x="44" y="47" width="8" height="8" rx="1.5" fill={c} stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
        </>
      );
    case "sandal":
      return (
        <>
          <path d="M6 48c0-4 4-6 8-6h38c4 0 6 3 6 6s-2 5-6 5H14c-4 0-8-1-8-5z" fill="#c9a97f" />
          <path d="M6 48c0-4 4-6 8-6h38c4 0 6 3 6 6H6z" {...light} />
          <path d="M20 42c0-8 8-14 14-14M34 42c0-10 8-12 14-8" {...stroke} stroke={c} strokeOpacity="1" strokeWidth="5" />
        </>
      );
  }
}

interface ProductThumbProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  shape: ProductShape;
  /** Variant colour name, e.g. "Tan". */
  colour?: string;
  className?: string;
  /** Accessible label; omit when the product name is shown right next to it. */
  label?: string;
}

/** A product picture tile on the warm product background (palette: product image background). */
export function ProductThumb({ shape, colour, className, label, ...rest }: ProductThumbProps) {
  const fill = (colour && COLOUR_FILL[colour]) || FALLBACK_FILL;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg bg-product-bg", className)}
      {...rest}
    >
      <svg viewBox="2 5 60 56" className="size-[92%]" aria-hidden="true">
        {art(shape, fill)}
      </svg>
    </span>
  );
}

