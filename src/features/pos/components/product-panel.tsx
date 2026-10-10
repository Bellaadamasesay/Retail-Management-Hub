"use client";

import { Check } from "lucide-react";
import { useMemo, useRef, useState, type RefObject } from "react";
import { Money } from "@/components/data/money";
import { SearchInput } from "@/components/data/search-input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProductPicture } from "@/features/catalog/components/product-picture";
import type { Category, Product, Variant } from "@/lib/api/types";
import { itemName, totalStock, variantColour, variantLabel } from "@/lib/inventory/stock";
import { cn } from "@/lib/utils";

const CATEGORIES: ("All" | Category)[] = ["All", "Shoes", "Bags", "Accessories"];

interface ProductPanelProps {
  products: Product[];
  searchRef: RefObject<HTMLInputElement | null>;
  /** Called with the chosen variant and the element to fly from. */
  onPick: (product: Product, variant: Variant, source: Element | null) => void;
  /** Enter in the search box with an exact label code (a handheld scan) adds that variation straight away. */
  onExactCode: (code: string) => boolean;
}

/** Search or scan, filter by category, and tap a tile to add it. Multi-variant products ask for colour and size first. */
export function ProductPanel({ products, searchRef, onPick, onExactCode }: ProductPanelProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | Category>("All");
  const [choosing, setChoosing] = useState<Product | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.active)
      .filter((p) => category === "All" || p.category === category)
      .filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.variants.some((v) => itemName(p, v).toLowerCase().includes(q)),
      );
  }, [products, query, category]);

  function pick(product: Product, source: Element | null) {
    const sellable = product.variants.filter((v) => v.stock > 0);
    if (product.variants.length === 1) onPick(product, product.variants[0], source);
    else if (sellable.length === 0) onPick(product, product.variants[0], source); // surfaces the sold-out message
    else setChoosing(product);
  }

  return (
    <section aria-label="Products" className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <SearchInput
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQuery("");
            if (e.key === "Enter" && query.trim() && onExactCode(query.trim())) setQuery("");
          }}
          placeholder="Search products…  ( / )"
          aria-label="Search products"
          className="flex-1"
        />
      </div>

      <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "h-9 rounded-lg border px-4 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              category === c
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-border bg-card hover:bg-surface-hover",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-text-secondary">
          Nothing matches &ldquo;{query}&rdquo;. Try a name, colour or size.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 min-[1700px]:grid-cols-4">
          {visible.map((product) => {
            const stock = totalStock(product);
            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={false}
                  onClick={(e) => pick(product, e.currentTarget.querySelector("[data-tile-picture]"))}
                  aria-label={`${product.name}, ${stock > 0 ? `${stock} in stock` : "sold out"}`}
                  className={cn(
                    "group flex w-full flex-col rounded-xl border bg-card p-2 text-left outline-none transition-[transform,box-shadow] duration-150 hover:shadow-soft focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
                    stock === 0 && "opacity-60",
                  )}
                >
                  <ProductPicture product={product} className="aspect-[4/3] w-full" data-tile-picture="" />
                  <span className="mt-2 text-[0.8125rem] font-medium leading-tight">{product.name}</span>
                  <Money amount={product.price} className="mt-0.5 text-sm font-semibold" />
                  <span className={cn("text-xs", stock === 0 ? "font-medium text-destructive" : "text-text-secondary")}>
                    {stock === 0 ? "Sold out" : `In stock: ${stock}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <VariantPicker
        product={choosing}
        onClose={() => setChoosing(null)}
        onPick={(variant, source) => {
          if (choosing) onPick(choosing, variant, source);
          setChoosing(null);
        }}
      />
    </section>
  );
}

function VariantPicker({
  product,
  onClose,
  onPick,
}: {
  product: Product | null;
  onClose: () => void;
  onPick: (variant: Variant, source: Element | null) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const preview = useRef<HTMLSpanElement>(null);

  // With two or more variation types, the first one (usually colour) is picked first,
  // then the rest; with one type every variation is a button straight away.
  const types = product?.optionTypes ?? [];
  const groupType = types.length > 1 ? types[0] : null;
  const rest = groupType ? types.slice(1) : types;
  const groups = product && groupType ? [...new Set(product.variants.map((v) => v.options[groupType]))] : [];
  const activeGroup =
    chosen && groups.includes(chosen)
      ? chosen
      : (groups.find((g) => product?.variants.some((v) => v.options[groupType!] === g && v.stock > 0)) ?? groups[0]);
  const options = product?.variants.filter((v) => !groupType || v.options[groupType] === activeGroup) ?? [];
  const optionLabel = (v: Variant) => rest.map((t) => v.options[t]).join(" · ");
  const shownColour = variantColour(options[0]);

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {product ? (
          <>
            <div className="flex items-center gap-3">
              <span ref={preview} className="contents">
                <ProductPicture product={product} colour={shownColour} className="size-16" />
              </span>
              <div>
                <DialogTitle className="font-display text-xl">{product.name}</DialogTitle>
                <DialogDescription>
                  <Money amount={product.price} /> · choose the {types.map((t) => t.toLowerCase()).join(" and ")}
                </DialogDescription>
              </div>
            </div>
            {groupType ? (
              <div role="radiogroup" aria-label={groupType} className="flex flex-wrap gap-2">
                {groups.map((g) => {
                  const left = product.variants.filter((v) => v.options[groupType] === g).reduce((n, v) => n + v.stock, 0);
                  return (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={g === activeGroup}
                      onClick={() => setChosen(g)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        g === activeGroup ? "border-primary bg-primary-subtle font-medium" : "border-border hover:bg-surface-hover",
                        left === 0 && "opacity-50",
                      )}
                    >
                      {g === activeGroup ? <Check className="size-3.5" aria-hidden="true" /> : null}
                      {g}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div role="group" aria-label={rest.join(" and ")} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {options.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={v.stock === 0}
                  onClick={(e) => onPick(v, e.currentTarget)}
                  aria-label={`${variantLabel(v)}, ${v.stock === 0 ? "sold out" : `${v.stock} left`}`}
                  className="flex h-14 flex-col items-center justify-center rounded-lg border border-border bg-card text-sm font-medium outline-none transition-[transform,background-color] hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  <span className="max-w-full truncate px-1">{optionLabel(v)}</span>
                  <span className={cn("text-[0.65rem] font-normal", v.stock <= v.reorderThreshold ? "text-warning" : "text-text-secondary")}>
                    {v.stock === 0 ? "sold out" : `${v.stock} left`}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
