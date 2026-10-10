import { z } from "zod";
import type { Product, ProductInput, Variant, VariantInput } from "@/lib/api/types";
import { parseLeones } from "@/lib/format/money";
import { combinations, comboKey, findVariant, optionsOf, typesOf, type VariationType } from "./variants";

/** Empty means none: a blank quantity is saved as 0. */
const count = (text: string | undefined) => (text?.trim() ? Number(text) : 0);
const isCount = (text: string | undefined) => /^\d*$/.test(text?.trim() ?? "");

export const productSchema = z
  .object({
    name: z.string().trim().min(1, "Give the product a name."),
    category: z.enum(["Shoes", "Bags", "Accessories"]),
    description: z.string(),
    price: z.string().refine((v) => parseLeones(v) > 0, "Enter a selling price above zero."),
    cost: z.string().refine((v) => parseLeones(v) >= 0, "Enter what the product costs you."),
    active: z.boolean(),
    image: z.string().nullable(),
    threshold: z.string().regex(/^\d+$/, "Use a whole number, e.g. 3."),
    /** False: one version with a single quantity. True: variation types and a quantity per combination. */
    varied: z.boolean(),
    quantity: z.string(),
    types: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
    /** Quantity typed per combination, keyed by comboKey(values). */
    quantities: z.record(z.string(), z.string()),
    /** Combinations the store doesn't carry (e.g. no size 45 in Tan). */
    excluded: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    if (!v.varied) {
      if (!isCount(v.quantity)) issue(["quantity"], "Use a whole number, e.g. 12.");
      return;
    }
    if (v.types.length === 0) {
      issue(["types"], "Add a variation type, e.g. Colour or Size.");
      return;
    }
    const seen = new Set<string>();
    v.types.forEach((t, i) => {
      const name = t.name.trim();
      if (!name) issue(["types", i, "name"], "Name this variation type, e.g. Material.");
      else if (seen.has(name.toLowerCase())) issue(["types", i, "name"], `${name} is listed twice.`);
      seen.add(name.toLowerCase());
      if (t.values.length === 0) issue(["types", i, "values"], `Add at least one ${name ? name.toLowerCase() : "value"}.`);
    });
    const rows = includedCombos(v);
    if (combinations(v.types).length > 0 && rows.length === 0) issue(["excluded"], "Keep at least one variation.");
    if (rows.some((values) => !isCount(v.quantities[comboKey(values)]))) {
      issue(["quantities"], "Quantities must be whole numbers.");
    }
  });

export type ProductFormValues = z.infer<typeof productSchema>;

/** The combinations that will be saved: every one of the types' values, minus those switched off. */
export function includedCombos(v: Pick<ProductFormValues, "types" | "excluded">): string[][] {
  const off = new Set(v.excluded);
  return combinations(v.types).filter((values) => !off.has(comboKey(values)));
}

const leonesText = (minor: number) => String(minor / 100);

export function formDefaults(product?: Product): ProductFormValues {
  if (!product) {
    return {
      name: "",
      category: "Shoes",
      description: "",
      price: "",
      cost: "",
      active: true,
      image: null,
      threshold: "3",
      varied: false,
      quantity: "",
      types: [],
      quantities: {},
      excluded: [],
    };
  }
  const types = typesOf(product.optionTypes, product.variants);
  const varied = types.length > 0;
  return {
    name: product.name,
    category: product.category,
    description: product.description,
    price: leonesText(product.price),
    cost: leonesText(product.cost),
    active: product.active,
    image: product.image,
    threshold: String(product.variants[0]?.reorderThreshold ?? 3),
    varied,
    quantity: varied ? "" : String(product.variants[0]?.stock ?? 0),
    types,
    quantities: Object.fromEntries(
      varied ? product.variants.map((v) => [comboKey(types.map((t) => v.options[t.name])), String(v.stock)]) : [],
    ),
    excluded: combinations(types)
      .filter((values) => !findVariant(product.variants, optionsOf(types, values)))
      .map(comboKey),
  };
}

/** What gets saved. Existing variations keep their id (and so their label code and history). */
export function toProductInput(v: ProductFormValues, product?: Product): ProductInput {
  const reorderThreshold = Number(v.threshold);
  const types: VariationType[] = v.varied ? v.types.map((t) => ({ name: t.name.trim(), values: t.values })) : [];
  const variants: VariantInput[] = v.varied
    ? includedCombos({ types, excluded: v.excluded }).map((values) => {
        const options = optionsOf(types, values);
        const saved = product ? findVariant(product.variants, options) : undefined;
        return { id: saved?.id, options, stock: count(v.quantities[comboKey(values)]), reorderThreshold };
      })
    : [
        {
          id: product?.optionTypes.length === 0 ? product.variants[0]?.id : undefined,
          options: {},
          stock: count(v.quantity),
          reorderThreshold,
        },
      ];
  return {
    name: v.name.trim(),
    category: v.category,
    description: v.description,
    price: parseLeones(v.price),
    cost: parseLeones(v.cost),
    active: v.active,
    image: v.image,
    optionTypes: types.map((t) => t.name),
    variants,
  };
}

/** Saved variations this edit would drop although they still have stock: their units would vanish unrecorded. */
export function strandedVariants(input: ProductInput, product: Product | undefined): Variant[] {
  if (!product) return [];
  const kept = new Set(input.variants.map((v) => v.id));
  return product.variants.filter((v) => !kept.has(v.id) && v.stock > 0);
}
