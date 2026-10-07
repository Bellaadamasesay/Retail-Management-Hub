"use client";

import Image from "next/image";
import { useState } from "react";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ProductThumb, shapeFor } from "./product-thumb";

interface ProductImageProps {
  /** Product code, e.g. "LTB": the photo lives at /images/products/ltb.jpg. */
  code: string;
  category: Category;
  /** Variant colour, used only by the drawn fallback for products that have no photo yet. */
  colour?: string;
  className?: string;
  /** Accessible name; leave out when the product name is printed beside the picture. */
  label?: string;
  sizes?: string;
}

/**
 * A product's photo on the warm product background. Products without a photo
 * (anything added after the seeded catalog) show a drawn picture of their
 * shape instead of a broken image.
 */
export function ProductImage({ code, category, colour, className, label, sizes = "160px", ...rest }: ProductImageProps) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return <ProductThumb shape={shapeFor(code, category)} colour={colour} label={label} className={className} {...rest} />;
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
        src={`/images/products/${code.toLowerCase()}.jpg`}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
        onError={() => setMissing(true)}
      />
    </span>
  );
}
