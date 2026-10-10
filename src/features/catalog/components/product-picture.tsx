import type { HTMLAttributes } from "react";
import { ProductImage } from "@/components/brand/product-image";
import type { Product } from "@/lib/api/types";
import { variantColour } from "@/lib/inventory/stock";

interface ProductPictureProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  product: Pick<Product, "image" | "category" | "name" | "variants">;
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
      src={product.image}
      name={product.name}
      category={product.category}
      colour={colour ?? variantColour(product.variants[0])}
      label={labelled ? product.name : undefined}
      className={className}
      sizes={sizes}
      data-flip-id={flipId}
      {...rest}
    />
  );
}
