"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Camera, Loader2, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ProductImage } from "@/components/brand/product-image";
import { Money } from "@/components/data/money";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import type { Category, Product } from "@/lib/api/types";
import { parseLeones } from "@/lib/format/money";
import { itemName } from "@/lib/inventory/stock";
import { Can } from "@/lib/rbac/can";
import { usePermission } from "@/lib/rbac/use-permission";
import { cn } from "@/lib/utils";
import { useCreateProduct, useUpdateProduct } from "../api/use-product-mutations";
import { formDefaults, includedCombos, productSchema, strandedVariants, toProductInput, type ProductFormValues } from "../lib/product-form";
import { CameraCapture } from "./camera-capture";
import { DeleteProductDialog } from "./delete-product-dialog";
import { PrintLabelsDialog } from "./print-labels-dialog";
import { VariationsEditor } from "./variations-editor";

const CATEGORIES: Category[] = ["Shoes", "Bags", "Accessories"];

/** Add a product (no `product`) or view and edit one. */
export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const params = useSearchParams();
  const canEdit = usePermission("products.edit");
  const readOnly = !canEdit;
  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // "Print labels" from the toast after adding a product lands here with ?labels=1.
  const [labelling, setLabelling] = useState(() => Boolean(product) && params.get("labels") === "1");

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: formDefaults(product),
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const values = useWatch({ control });
  const image = values.image ?? null;

  // The drawn stand-in (no photo yet) takes the colour of the first variation, if it has one.
  const types = values.types ?? [];
  const colourIndex = types.findIndex((t) => /^colou?r$/i.test(t.name?.trim() ?? ""));
  const firstCombo = values.varied ? includedCombos({ types: types as ProductFormValues["types"], excluded: values.excluded ?? [] })[0] : undefined;
  const previewColour = colourIndex >= 0 ? firstCombo?.[colourIndex] : undefined;

  const price = parseLeones(values.price ?? "");
  const cost = parseLeones(values.cost ?? "");
  const margin = price > 0 && cost >= 0 ? Math.round(((price - cost) / price) * 100) : null;

  async function onSubmit(data: ProductFormValues) {
    setServerError(null);
    const input = toProductInput(data, product);
    const [stranded] = strandedVariants(input, product);
    if (stranded && product) {
      setServerError(`${itemName(product, stranded)} still has ${stranded.stock} in stock. Set its quantity to 0 and save before removing it.`);
      return;
    }
    try {
      if (product) {
        await update.mutateAsync(input);
        toast.success(`Saved ${input.name}`, { description: "The catalog is up to date." });
        router.refresh();
      } else {
        const created = await create.mutateAsync(input);
        const units = created.variants.reduce((n, v) => n + v.stock, 0);
        toast.success(`Added ${created.name}`, {
          description:
            created.optionTypes.length === 0
              ? `${units} in stock. Stick a label on each one so the till can scan it.`
              : `${created.variants.length} variations, ${units} in stock. Stick a label on each item so the till can scan it.`,
          action: { label: "Print labels", onClick: () => router.push(`/products/${created.id}?labels=1`) },
          duration: 10_000,
        });
        router.push("/products");
      }
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : "We couldn’t save that. Check your connection and try again.",
      );
    }
  }

  function closeLabels(open: boolean) {
    setLabelling(open);
    if (!open && params.get("labels") && product) router.replace(`/products/${product.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-8">
      <PageHeader
        title={product ? product.name : "Add Product"}
        description={
          product
            ? readOnly
              ? "Product details. You can look but not change them with your role."
              : "Update details, price, variations and stock. Every stock change is logged."
            : "Name it, price it, say whether it comes in variations, and how many you have."
        }
        actions={
          <>
            <Link href="/products" className={buttonVariants({ variant: "outline", className: "h-10" })}>
              <ArrowLeft aria-hidden="true" /> Back to products
            </Link>
            {product && canEdit ? (
              <Button type="button" variant="outline" className="h-10" onClick={() => setLabelling(true)}>
                <Printer aria-hidden="true" /> Print labels
              </Button>
            ) : null}
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
              <Field label="Product name" htmlFor="name" error={errors.name?.message}>
                <Input
                  id="name"
                  disabled={readOnly}
                  placeholder="e.g. Leather Tote Bag"
                  aria-invalid={Boolean(errors.name)}
                  {...register("name")}
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
              <CardTitle className="font-display text-lg font-semibold">Stock and variations</CardTitle>
            </CardHeader>
            <CardContent>
              <VariationsEditor form={form} product={product} readOnly={readOnly} />
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-0 xl:self-start">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setCapturing(true)}
                aria-label={image ? "Retake the product photo" : "Take a product photo"}
                className="group relative rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
              >
                <ProductImage
                  src={image}
                  name={values.name || ""}
                  category={values.category ?? "Shoes"}
                  colour={previewColour}
                  className="aspect-square w-full"
                  sizes="336px"
                />
                {!readOnly ? (
                  <span className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-lg bg-black/55 py-2 text-sm font-medium text-white opacity-90 transition-opacity group-hover:opacity-100">
                    <Camera className="size-4" aria-hidden="true" /> {image ? "Retake photo" : "Take photo"}
                  </span>
                ) : null}
              </button>
              {image && !readOnly ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue("image", null, { shouldDirty: true })}>
                  Remove photo
                </Button>
              ) : null}
              <p className="text-xs text-text-secondary">
                {image
                  ? "Shown in the catalog, on stock lists and at the till."
                  : "No photo yet: a drawing stands in until you snap one."}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <CameraCapture
        open={capturing}
        onOpenChange={setCapturing}
        onCapture={(url) => setValue("image", url, { shouldDirty: true })}
      />

      {product ? (
        <>
          <PrintLabelsDialog product={product} open={labelling} onOpenChange={closeLabels} />
          <DeleteProductDialog
            product={product}
            open={deleting}
            onOpenChange={setDeleting}
            onDeleted={() => router.push("/products")}
          />
        </>
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
