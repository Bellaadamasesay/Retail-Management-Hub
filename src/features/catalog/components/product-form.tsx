"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ProductImage } from "@/components/brand/product-image";
import { KNOWN_COLOURS } from "@/components/brand/product-thumb";
import { Money } from "@/components/data/money";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import type { Category, Product, ProductInput } from "@/lib/api/types";
import { parseLeones } from "@/lib/format/money";
import { variantLabel } from "@/lib/inventory/stock";
import { Can } from "@/lib/rbac/can";
import { usePermission } from "@/lib/rbac/use-permission";
import { cn } from "@/lib/utils";
import { useCreateProduct, useUpdateProduct } from "../api/use-product-mutations";
import { useProducts } from "../api/use-products";
import { deriveProductCode, generateVariants, SIZE_PRESETS } from "../lib/variants";
import { ChipInput } from "./chip-input";
import { DeleteProductDialog } from "./delete-product-dialog";

const CATEGORIES: Category[] = ["Shoes", "Bags", "Accessories"];

const schema = z.object({
  name: z.string().trim().min(1, "Give the product a name."),
  code: z.string().regex(/^[A-Z0-9]{2,6}$/, "Use 2 to 6 capital letters or digits, e.g. LTB."),
  category: z.enum(["Shoes", "Bags", "Accessories"]),
  description: z.string(),
  price: z.string().refine((v) => parseLeones(v) > 0, "Enter a selling price above zero."),
  cost: z.string().refine((v) => parseLeones(v) >= 0, "Enter what the product costs you."),
  threshold: z.string().regex(/^\d+$/, "Use a whole number, e.g. 3."),
  active: z.boolean(),
  colours: z.array(z.string()).min(1, "Add at least one colour."),
  sizes: z.array(z.string()).min(1, "Choose at least one size."),
});

type FormValues = z.infer<typeof schema>;

const leonesText = (minor: number) => String(minor / 100);

function defaults(product?: Product): FormValues {
  if (!product) {
    return {
      name: "",
      code: "",
      category: "Shoes",
      description: "",
      price: "",
      cost: "",
      threshold: "3",
      active: true,
      colours: [],
      sizes: [...SIZE_PRESETS[0].sizes],
    };
  }
  const uniq = (items: string[]) => [...new Set(items)];
  return {
    name: product.name,
    code: product.code,
    category: product.category,
    description: product.description,
    price: leonesText(product.price),
    cost: leonesText(product.cost),
    threshold: String(product.variants[0]?.reorderThreshold ?? 3),
    active: product.active,
    colours: uniq(product.variants.map((v) => v.colour)),
    sizes: uniq(product.variants.map((v) => v.size)),
  };
}

/** Add a product (no `product`) or view and edit one. Cashiers get the same page read-only. */
export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const canEdit = usePermission("products.edit");
  const readOnly = !canEdit;
  const catalog = useProducts();
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [codeEdited, setCodeEdited] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(product),
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const values = useWatch({ control });
  const colours = useWatch({ control, name: "colours" });
  const sizes = useWatch({ control, name: "sizes" });

  const others = useMemo(
    () => (catalog.data ?? []).filter((p) => p.id !== product?.id),
    [catalog.data, product?.id],
  );

  const threshold = /^\d+$/.test(values.threshold ?? "") ? Number(values.threshold) : 3;
  const code = values.code ?? "";
  const variants = useMemo(
    () =>
      code.length >= 2 && colours.length > 0 && sizes.length > 0
        ? generateVariants({
            productCode: code,
            colours,
            sizes,
            reorderThreshold: threshold,
            existing: product?.variants,
          })
        : [],
    [code, colours, sizes, threshold, product?.variants],
  );

  const stockById = new Map((product?.variants ?? []).map((v) => [v.id, v.stock]));
  // Colours and sizes that still hold stock can't be removed.
  const locked = (key: "colour" | "size") =>
    Object.fromEntries(
      (product?.variants ?? [])
        .filter((v) => v.stock > 0)
        .map((v) => [v[key], "Still holds stock. Sell or adjust it first."]),
    );

  const preview = variants.find((v) => (v.id ?? v.sku) === selectedId) ?? variants[0];

  const price = parseLeones(values.price ?? "");
  const cost = parseLeones(values.cost ?? "");
  const margin = price > 0 && cost >= 0 ? Math.round(((price - cost) / price) * 100) : null;

  async function onSubmit(data: FormValues) {
    setServerError(null);
    const input: ProductInput = {
      code: data.code,
      name: data.name.trim(),
      category: data.category,
      description: data.description,
      price: parseLeones(data.price),
      cost: parseLeones(data.cost),
      active: data.active,
      variants,
    };
    try {
      if (product) {
        await update.mutateAsync(input);
        toast.success(`Saved ${input.name}`, { description: "The catalog is up to date." });
        router.refresh();
        form.reset(data);
      } else {
        await create.mutateAsync(input);
        toast.success(`Added ${input.name}`, {
          description: `${variants.length} ${variants.length === 1 ? "variant" : "variants"} created. Record stock through Stock Intake.`,
        });
        router.push("/products");
      }
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : "We couldn’t save that. Check your connection and try again.",
      );
    }
  }

  const presetLabel =
    SIZE_PRESETS.find(
      (p) => p.sizes.length === sizes.length && p.sizes.every((s) => sizes.includes(s)),
    )?.label ?? "Custom";

  function applyPreset(presetSizes: readonly string[]) {
    // Keep sizes that still hold stock so applying a preset can never orphan units.
    const keep = Object.keys(locked("size"));
    setValue("sizes", [...new Set([...presetSizes, ...keep])], { shouldDirty: true, shouldValidate: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
      <PageHeader
        title={product ? product.name : "Add Product"}
        description={
          product
            ? readOnly
              ? "Product details. You can look but not change them with your role."
              : "Update details, price and variants. Stock moves through intake, stock take and sales."
            : "Create a product, then add the colours and sizes it comes in."
        }
        actions={
          <>
            <Link href="/products" className={buttonVariants({ variant: "outline", className: "h-10" })}>
              <ArrowLeft aria-hidden="true" /> Back to products
            </Link>
            {product ? (
              <Can permission="products.delete">
                <Button type="button" variant="destructive" className="h-10" onClick={() => setDeleting(true)}>
                  <Trash2 aria-hidden="true" /> Delete
                </Button>
              </Can>
            ) : null}
            {!readOnly ? (
              <Button type="submit" className="h-10" disabled={isSubmitting || (!!product && !isDirty)}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" /> Saving…
                  </>
                ) : product ? (
                  "Save changes"
                ) : (
                  "Add product"
                )}
              </Button>
            ) : null}
          </>
        }
      />

      {serverError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex flex-col gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field label="Product name" htmlFor="name" error={errors.name?.message} className="sm:col-span-2">
                <Input
                  id="name"
                  disabled={readOnly}
                  placeholder="e.g. Leather Tote Bag"
                  aria-invalid={Boolean(errors.name)}
                  {...register("name", {
                    onChange: (e) => {
                      if (!product && !codeEdited) {
                        setValue("code", deriveProductCode(e.target.value, others.map((p) => p.code)), {
                          shouldValidate: true,
                        });
                      }
                    },
                  })}
                />
              </Field>
              <Field
                label="Product code"
                htmlFor="code"
                error={errors.code?.message}
                hint={product ? "The SKU prefix. It can’t change once variants exist." : "Used as the start of every SKU, e.g. LTB-BLA-OS."}
              >
                <Input
                  id="code"
                  disabled={readOnly || !!product}
                  className="font-mono uppercase"
                  aria-invalid={Boolean(errors.code)}
                  {...register("code", {
                    onChange: (e) => {
                      setCodeEdited(true);
                      e.target.value = e.target.value.toUpperCase();
                    },
                  })}
                />
              </Field>
              <Field label="Category" htmlFor="category">
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                      disabled={readOnly}
                      items={CATEGORIES.map((c) => ({ value: c, label: c }))}
                    >
                      <SelectTrigger id="category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Description" htmlFor="description" className="sm:col-span-2">
                <Textarea
                  id="description"
                  rows={3}
                  disabled={readOnly}
                  placeholder="Materials, fit and anything a customer asks about."
                  {...register("description")}
                />
              </Field>
              <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      disabled={readOnly}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      aria-label="Active"
                    />
                  )}
                />
                <span>
                  <span className="font-medium">Active</span>
                  <span className="text-text-secondary"> · can be sold at the POS. Untick to retire it without deleting.</span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-3">
              <Field label="Selling price" htmlFor="price" error={errors.price?.message}>
                <LeonesInput id="price" disabled={readOnly} invalid={Boolean(errors.price)} {...register("price")} />
              </Field>
              <Field label="Cost price" htmlFor="cost" error={errors.cost?.message}>
                <LeonesInput id="cost" disabled={readOnly} invalid={Boolean(errors.cost)} {...register("cost")} />
              </Field>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Margin</span>
                <p className="flex h-10 items-center text-sm">
                  {margin === null ? (
                    <span className="text-text-secondary">Enter both prices</span>
                  ) : (
                    <>
                      <span className="font-semibold tabular">{margin}%</span>
                      <span className="ml-2 text-text-secondary">
                        (<Money amount={price - cost} /> per item)
                      </span>
                    </>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold">Colours and sizes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-8">
              <Controller
                control={control}
                name="colours"
                render={({ field }) => (
                  <ChipInput
                    label="Colours"
                    values={field.value}
                    onChange={(next) => field.onChange(next)}
                    placeholder="Type a colour and press Enter"
                    suggestions={KNOWN_COLOURS}
                    locked={locked("colour")}
                    disabled={readOnly}
                    error={errors.colours?.message}
                  />
                )}
              />

              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Size set</span>
                <div role="radiogroup" aria-label="Size set" className="flex flex-wrap gap-2">
                  {[...SIZE_PRESETS.map((p) => p.label), "Custom"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={presetLabel === label}
                      disabled={readOnly || label === "Custom"}
                      onClick={() => applyPreset(SIZE_PRESETS.find((p) => p.label === label)!.sizes)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                        presetLabel === label
                          ? "border-primary bg-primary-subtle font-medium text-accent-foreground"
                          : "border-border bg-card hover:bg-surface-hover disabled:hover:bg-card",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Controller
                control={control}
                name="sizes"
                render={({ field }) => (
                  <ChipInput
                    label="Sizes"
                    values={field.value}
                    onChange={(next) => field.onChange(next)}
                    placeholder="Type a size and press Enter"
                    locked={locked("size")}
                    disabled={readOnly}
                    error={errors.sizes?.message}
                    hint="Pick a set above, then add or remove individual sizes."
                  />
                )}
              />

              <Field
                label="Reorder level for new variants"
                htmlFor="threshold"
                error={errors.threshold?.message}
                hint="Management is alerted when a variant falls to this many units."
                className="max-w-xs"
              >
                <Input
                  id="threshold"
                  inputMode="numeric"
                  disabled={readOnly}
                  aria-invalid={Boolean(errors.threshold)}
                  {...register("threshold")}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold">
                Variants <span className="ml-1 text-sm font-normal text-text-secondary">{variants.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {variants.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Add a name, at least one colour and one size to see the SKUs that will be created.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-background-subtle text-left text-xs text-table-header">
                      <tr>
                        <th className="px-4 py-3 font-medium">Variant</th>
                        <th className="px-4 py-3 font-medium">SKU</th>
                        <th className="px-4 py-3 text-right font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v) => {
                        const key = v.id ?? v.sku;
                        const stock = v.id ? stockById.get(v.id) : undefined;
                        return (
                          <tr
                            key={key}
                            data-selected={preview === v}
                            onClick={() => setSelectedId(key)}
                            className={cn(
                              "cursor-pointer border-t border-border-subtle hover:bg-table-hover",
                              preview === v && "bg-table-selected",
                            )}
                          >
                            <td className="px-4 py-3">{variantLabel(v)}</td>
                            <td className="px-4 py-3 font-mono text-xs">{v.sku}</td>
                            <td className="px-4 py-3 text-right tabular">
                              {stock === undefined ? <Badge variant="info">New</Badge> : stock}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <ProductImage
                code={code}
                category={values.category ?? "Shoes"}
                colour={preview?.colour ?? colours[0]}
                label={values.name || "Product picture"}
                className="aspect-square w-full"
                sizes="336px"
              />
              {preview ? (
                <>
                  <div>
                    <p className="font-medium">{variantLabel(preview)}</p>
                    <p className="font-mono text-xs text-text-secondary">{preview.sku}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-text-secondary">
                  The picture appears here once you add a colour and size.
                </p>
              )}
              <p className="text-xs text-text-secondary">
                Select a variant in the table to see it in its colour.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {product ? (
        <DeleteProductDialog
          product={product}
          open={deleting}
          onOpenChange={setDeleting}
          onDeleted={() => router.push("/products")}
        />
      ) : null}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
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

/** A text field with a fixed "Le" prefix. */
function LeonesInput({
  invalid,
  ...props
}: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-text-secondary">
        Le
      </span>
      <Input inputMode="decimal" placeholder="0" aria-invalid={invalid} className="pl-9" {...props} />
    </div>
  );
}
