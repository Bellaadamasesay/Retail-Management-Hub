"use client";

import { Plus, Undo2, X } from "lucide-react";
import { useState } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { KNOWN_COLOURS } from "@/components/brand/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { ProductFormValues } from "../lib/product-form";
import { combinations, comboKey, findVariant, optionsOf, SIZE_PRESETS, SUGGESTED_TYPES } from "../lib/variants";
import { ChipInput } from "./chip-input";

const MAX_TYPES = 3;

interface VariationsEditorProps {
  form: UseFormReturn<ProductFormValues>;
  /** The saved product when editing: its stock decides what can still change. */
  product?: Product;
  readOnly: boolean;
}

/**
 * "One version" with a single quantity, or variation types (Colour, Size,
 * Material…) whose values combine into variations, each with its own quantity.
 * Anything that still holds stock is locked until its quantity is set to 0 and saved,
 * so units never disappear without a record.
 */
export function VariationsEditor({ form, product, readOnly }: VariationsEditorProps) {
  const { control, register, setValue, formState } = form;
  const errors = formState.errors;
  const varied = useWatch({ control, name: "varied" });
  const types = useWatch({ control, name: "types" });
  const quantities = useWatch({ control, name: "quantities" });
  const excluded = useWatch({ control, name: "excluded" });
  const [fillAll, setFillAll] = useState("");

  const saved = product?.variants ?? [];
  // Changing the types re-cuts every variation, which would strand stock.
  const typesLocked = saved.some((v) => v.stock > 0);
  const savedTypes = new Set(product?.optionTypes ?? []);
  const dirty = { shouldDirty: true, shouldValidate: formState.isSubmitted };

  // A record field's error carries its message at the top level.
  const tableError = (errors.quantities as { message?: string } | undefined)?.message ?? errors.excluded?.message;

  const combos = combinations(types);
  const off = new Set(excluded);

  function setTypes(next: ProductFormValues["types"]) {
    setValue("types", next, dirty);
  }

  function addType(name: string) {
    setTypes([...types, { name, values: [] }]);
  }

  function lockedValues(typeName: string): Record<string, string> {
    if (!savedTypes.has(typeName)) return {};
    const result: Record<string, string> = {};
    for (const v of saved) {
      if (v.stock > 0) result[v.options[typeName]] = "Still has stock. Set its quantities to 0 and save first.";
    }
    return result;
  }

  function setQuantity(key: string, text: string) {
    setValue("quantities", { ...quantities, [key]: text.replace(/\D/g, "") }, dirty);
  }

  function toggle(key: string) {
    setValue("excluded", off.has(key) ? excluded.filter((k) => k !== key) : [...excluded, key], dirty);
  }

  function applyToAll() {
    if (!/^\d+$/.test(fillAll)) return;
    setValue(
      "quantities",
      { ...quantities, ...Object.fromEntries(combos.filter((c) => !off.has(comboKey(c))).map((c) => [comboKey(c), fillAll])) },
      dirty,
    );
  }

  const remaining = SUGGESTED_TYPES.filter((s) => !types.some((t) => t.name.trim().toLowerCase() === s.toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Does this product come in variations?" className="grid gap-2 sm:grid-cols-2">
        {[
          { value: false, title: "One version", hint: "Sold as it is, one quantity." },
          { value: true, title: "Several variations", hint: "Different colours, sizes, materials…" },
        ].map((option) => (
          <button
            key={option.title}
            type="button"
            role="radio"
            aria-checked={varied === option.value}
            disabled={readOnly || (typesLocked && varied !== option.value)}
            onClick={() => setValue("varied", option.value, dirty)}
            className={cn(
              "flex flex-col rounded-lg border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
              varied === option.value ? "border-primary bg-primary-subtle" : "border-border bg-card hover:bg-surface-hover",
            )}
          >
            <span className="text-sm font-semibold">{option.title}</span>
            <span className="text-xs text-text-secondary">{option.hint}</span>
          </button>
        ))}
      </div>
      {typesLocked && !readOnly ? (
        <p className="-mt-3 text-xs text-text-secondary">
          The variation types can’t change while the product has stock. Set every quantity to 0 and save first.
        </p>
      ) : null}

      {!varied ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            label="Quantity in stock"
            id="quantity"
            disabled={readOnly}
            error={errors.quantity?.message}
            hint={product && product.optionTypes.length === 0 ? `${saved[0]?.stock ?? 0} on record. Changes are logged.` : "How many you have right now."}
            {...register("quantity")}
          />
          <NumberField
            label="Reorder level"
            id="threshold"
            disabled={readOnly}
            error={errors.threshold?.message}
            hint="You’re alerted when stock falls to this."
            {...register("threshold")}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {types.map((type, i) => {
              const isSaved = savedTypes.has(type.name);
              const name = type.name.trim().toLowerCase();
              return (
                <div key={i} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-end gap-2">
                    <div className="flex flex-1 flex-col gap-2">
                      <Label htmlFor={`type-${i}`} className="text-sm font-semibold">
                        Variation type
                      </Label>
                      <Input
                        id={`type-${i}`}
                        disabled={readOnly || isSaved}
                        placeholder="e.g. Material"
                        aria-invalid={Boolean(errors.types?.[i]?.name)}
                        {...register(`types.${i}.name`)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={readOnly || typesLocked}
                      aria-label={`Remove ${type.name || "this variation type"}`}
                      onClick={() => setTypes(types.filter((_, j) => j !== i))}
                    >
                      <X />
                    </Button>
                  </div>
                  {errors.types?.[i]?.name ? (
                    <p role="alert" className="-mt-1 text-sm text-destructive">
                      {errors.types[i].name.message}
                    </p>
                  ) : null}
                  <Controller
                    control={control}
                    name={`types.${i}.values`}
                    render={({ field }) => (
                      <ChipInput
                        label={type.name ? `${type.name} options` : "Options"}
                        values={field.value}
                        onChange={(next) => field.onChange(next)}
                        placeholder="Type one and press Enter"
                        suggestions={/^colou?r$/.test(name) ? KNOWN_COLOURS : []}
                        locked={lockedValues(type.name)}
                        disabled={readOnly}
                        error={errors.types?.[i]?.values?.message}
                      />
                    )}
                  />
                  {name === "size" && !readOnly ? (
                    <div className="flex flex-wrap gap-2">
                      {SIZE_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setTypes(types.map((t, j) => (j === i ? { ...t, values: [...new Set([...t.values, ...preset.sizes])] } : t)))
                          }
                        >
                          <Plus aria-hidden="true" /> {preset.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {!readOnly && !typesLocked && types.length < MAX_TYPES ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-text-secondary">Add a variation type:</span>
                {remaining.map((s) => (
                  <Button key={s} type="button" size="sm" variant="outline" onClick={() => addType(s)}>
                    <Plus aria-hidden="true" /> {s}
                  </Button>
                ))}
                <Button type="button" size="sm" variant="ghost" onClick={() => addType("")}>
                  <Plus aria-hidden="true" /> Other
                </Button>
              </div>
            ) : null}
            {errors.types?.message || errors.types?.root?.message ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.types.message ?? errors.types.root?.message}
              </p>
            ) : null}
          </div>

          <NumberField
            label="Reorder level"
            id="threshold"
            disabled={readOnly}
            error={errors.threshold?.message}
            hint="For every variation: you’re alerted when one falls to this."
            className="max-w-xs"
            {...register("threshold")}
          />

          {combos.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    Quantities <span className="font-normal text-text-secondary">· {combos.length - off.size} variations</span>
                  </p>
                  <p className="text-xs text-text-secondary">Switch off any combination you don’t carry.</p>
                </div>
                {!readOnly ? (
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="numeric"
                      value={fillAll}
                      onChange={(e) => setFillAll(e.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                      aria-label="Quantity for every variation"
                      className="h-9 w-20 text-right tabular"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={applyToAll} disabled={!fillAll}>
                      Set all
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-background-subtle text-left text-xs text-table-header">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Variation</th>
                      {product ? <th className="px-4 py-2.5 text-right font-medium">On record</th> : null}
                      <th className="px-4 py-2.5 text-right font-medium">Quantity</th>
                      <th className="w-12 px-2 py-2.5">
                        <span className="sr-only">Carried</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {combos.map((values) => {
                      const key = comboKey(values);
                      const label = values.join(" · ");
                      const existing = findVariant(saved, optionsOf(types, values));
                      const isOff = off.has(key);
                      const holdsStock = (existing?.stock ?? 0) > 0;
                      return (
                        <tr key={key} className={cn("border-t border-border-subtle", isOff && "bg-background-subtle text-text-muted")}>
                          <td className="px-4 py-2">
                            <span className={cn(isOff && "line-through")}>{label}</span>
                            {!existing && !isOff && product ? (
                              <Badge variant="info" className="ml-2">
                                New
                              </Badge>
                            ) : null}
                          </td>
                          {product ? <td className="px-4 py-2 text-right tabular text-text-secondary">{existing ? existing.stock : "–"}</td> : null}
                          <td className="px-4 py-2 text-right">
                            <Input
                              inputMode="numeric"
                              value={quantities[key] ?? ""}
                              onChange={(e) => setQuantity(key, e.target.value)}
                              disabled={readOnly || isOff}
                              placeholder="0"
                              aria-label={`Quantity of ${label}`}
                              className="ml-auto h-9 w-24 text-right tabular"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={readOnly || (holdsStock && !isOff)}
                              title={holdsStock && !isOff ? "Still has stock. Set its quantity to 0 and save first." : undefined}
                              aria-label={isOff ? `Carry ${label} again` : `Don’t carry ${label}`}
                              onClick={() => toggle(key)}
                            >
                              {isOff ? <Undo2 /> : <X />}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {tableError ? (
                <p role="alert" className="text-sm text-destructive">
                  {tableError}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function NumberField({
  label,
  id,
  error,
  hint,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: string; id: string; error?: string; hint?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input id={id} inputMode="numeric" placeholder="0" aria-invalid={Boolean(error)} {...props} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-secondary">{hint}</p>
      ) : null}
    </div>
  );
}
