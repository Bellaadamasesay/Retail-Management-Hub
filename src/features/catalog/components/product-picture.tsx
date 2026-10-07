import type { HTMLAttributes } from "react";
import { ProductImage } from "@/components/brand/product-image";
import type { Product } from "@/lib/api/types";

interface ProductPictureProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  product: Pick<Product, "code" | "category" | "name" | "variants">;
  /** Colour of the variant on show (used by the drawn fallback only; photos are per product). */
  colour?: string;
  className?: string;
  /** Add an accessible name (omit when the name is printed beside the picture). */
  labelled?: boolean;
  /** Stable id so GSAP Flip can follow this picture between layouts. */
  flipId?: string;
  /** Rendered width hint for the image optimiser. */
  sizes?: string;
}

export function ProductPicture({ product, colour, className, labelled = false, flipId, sizes, ...rest }: ProductPictureProps) {
  return (
    <ProductImage
      code={product.code}
      category={product.category}
      colour={colour ?? product.variants[0]?.colour}
      label={labelled ? product.name : undefined}
      className={className}
      sizes={sizes}
      data-flip-id={flipId}
      {...rest}
    />
  );
}
