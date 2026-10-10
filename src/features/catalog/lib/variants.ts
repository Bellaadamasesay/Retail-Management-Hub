import type { Variant } from "@/lib/api/types";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

/** One-tap value sets offered for a "Size" variation type. */
export const SIZE_PRESETS = [
  { label: "Shoe sizes 36–45", sizes: range(36, 45) },
  { label: "S, M, L", sizes: ["S", "M", "L"] },
] as const;

/** Variation types offered as one-tap additions; anything else can be typed. */
export const SUGGESTED_TYPES = ["Colour", "Size", "Material", "Style"] as const;

export interface VariationType {
  name: string;
  values: string[];
}

/** Stable key for one combination of values (in type order). */
export const comboKey = (values: readonly string[]) => JSON.stringify(values);

/** Every combination of the types' values, e.g. Colour [Black, Tan] x Size [40, 41] -> 4 combinations. */
export function combinations(types: readonly VariationType[]): string[][] {
  if (types.length === 0 || types.some((t) => t.values.length === 0)) return [];
  return types.reduce<string[][]>(
    (acc, type) => acc.flatMap((combo) => type.values.map((value) => [...combo, value])),
    [[]],
  );
}

/** { Colour: "Black", Size: "40" } from type names and one combination of values. */
export function optionsOf(types: readonly VariationType[], values: readonly string[]): Record<string, string> {
  return Object.fromEntries(types.map((t, i) => [t.name.trim(), values[i]]));
}

export function sameOptions(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/** The saved variation with exactly these values, if any. */
export function findVariant(variants: readonly Variant[], options: Record<string, string>): Variant | undefined {
  return variants.find((v) => sameOptions(v.options, options));
}

/** The product's variation types with their values, in the order they first appear. */
export function typesOf(optionTypes: readonly string[], variants: readonly Variant[]): VariationType[] {
  return optionTypes.map((name) => ({ name, values: [...new Set(variants.map((v) => v.options[name]))] }));
}
