"use client";

import Image from "next/image";
import { useState } from "react";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ProductThumb, shapeFor } from "./product-thumb";

interface ProductImageProps {
  /** The product's photo URL (or data URL); null draws a picture of its shape instead. */
  src: string | null;
  /** Picks the drawn shape when there is no photo. */
  name: string;
  category: Category;
  /** Variant colour, used only by the drawn fallback for products that have no photo yet. */
  colour?: string;
  className?: string;
  /** Accessible name; leave out when the product name is printed beside the picture. */
  label?: string;
  sizes?: string;
}

/**
 * A product's photo on the warm product background. Products without a photo,
 * or whose photo fails to load, show a drawn picture of their shape instead of
 * a broken image.
 */
export function ProductImage({ src, name, category, colour, className, label, sizes = "160px", ...rest }: ProductImageProps) {
  const [failed, setFailed] = useState<string | null>(null);

  if (!src || failed === src) {
    return <ProductThumb shape={shapeFor(name, category)} colour={colour} label={label} className={className} {...rest} />;
  }
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative block shrink-0 overflow-hidden rounded-lg bg-product-bg", className)}
      {...rest}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        // Photos are small JPEGs served by our API (behind sign-in): use them as they are.
        unoptimized
        className="object-cover"
        onError={() => setFailed(src)}
      />
    </span>
  );
}
