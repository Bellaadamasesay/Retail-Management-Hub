"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Minus, PackageSearch, Plus, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data/data-table";
import { Money } from "@/components/data/money";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProducts } from "@/features/catalog/api/use-products";
import { ProductPicture } from "@/features/catalog/components/product-picture";
import { ApiError } from "@/lib/api/client";
import type { Product, StockIntake, Variant } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney, parseLeones } from "@/lib/format/money";
import { variantLabel } from "@/lib/inventory/stock";
import { cn } from "@/lib/utils";
import { useStaffName } from "@/features/users/api/use-users";
import { useCreateIntake, useIntakes } from "../api/use-intakes";

interface Line {
  variantId: string;
  quantity: number;
  /** Leones as typed, so partial input like "12." isn't mangled. */
  unitCost: string;
}

const lineKey = "variantId";

export function IntakeView() {
  const params = useSearchParams();
  const products = useProducts();
  const intakes = useIntakes();
  const create = useCreateIntake();
  const staffName = useStaffName();
  const recentColumns = useMemo(() => buildRecentColumns(staffName), [staffName]);

  const [supplier, setSupplier] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preloaded = useRef(false);

  const variants = useMemo(() => {
    const map = new Map<string, { variant: Variant; product: Product }>();
    for (const product of products.data ?? []) {
      for (const variant of product.variants) map.set(variant.id, { variant, product });
    }
    return map;
  }, [products.data]);

  function addVariant(variantId: string, quantity = 1) {
    const entry = variants.get(variantId);
    if (!entry) return;
    setLines((current) => {
      const existing = current.find((l) => l.variantId === variantId);
      if (existing) {
        return current.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + quantity } : l));
      }
      return [...current, { variantId, quantity, unitCost: String(entry.product.cost / 100) }];
    });
    setFlash(variantId);
  }

  // Arriving from Inventory's "Receive stock" action: start with that variant on the list.
  useEffect(() => {
    const id = params.get("variant");
    if (id && !preloaded.current && variants.has(id)) {
      preloaded.current = true;
      addVariant(id);
    }
  });

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [flash]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...variants.values()]
      .filter(
        ({ variant, product }) =>
          product.name.toLowerCase().includes(q) || variant.sku.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, variants]);

  const knownSuppliers = useMemo(() => [...new Set((intakes.data ?? []).map((i) => i.supplier))], [intakes.data]);

  const totals = lines.reduce(
    (acc, l) => {
      const cost = parseLeones(l.unitCost);
      return { units: acc.units + l.quantity, cost: acc.cost + (Number.isFinite(cost) ? cost * l.quantity : 0) };
    },
    { units: 0, cost: 0 },
  );

  function setQuantity(variantId: string, quantity: number) {
    setLines((current) =>
      current.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.floor(quantity) || 1) } : l)),
    );
  }

  async function submit() {
    setError(null);
    if (!supplier.trim()) return setError("Say which supplier this delivery came from.");
    if (lines.length === 0) return setError("Add at least one item to the delivery.");
    const costs = lines.map((l) => parseLeones(l.unitCost));
    if (costs.some((c) => !Number.isFinite(c) || c < 0)) return setError("Enter the cost price for every item.");

    try {
      const intake = await create.mutateAsync({
        supplier,
        batchNote,
        lines: lines.map((l, i) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: costs[i] })),
      });
      toast.success(`Delivery ${intake.reference} recorded`, {
        description: `${totals.units} ${totals.units === 1 ? "unit" : "units"} added to stock.`,
      });
      setLines([]);
      setSupplier("");
      setBatchNote("");
      setQuery("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn’t record that. Check your connection and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Stock Intake"
        description="Record a delivery from a supplier. Search for each item and enter how many arrived."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold">Add items</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[1.1rem] -translate-y-1/2 text-text-secondary" aria-hidden="true" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or SKU…"
                  aria-label="Find an item to add"
                  className="h-11 pl-10"
                />
                {matches.length > 0 ? (
                  <ul
                    role="listbox"
                    aria-label="Matching items"
                    className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl bg-popover p-1 shadow-lifted ring-1 ring-border"
                  >
                    {matches.map(({ variant, product }) => (
                      <li key={variant.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected="false"
                          onClick={() => {
                            addVariant(variant.id);
                            setQuery("");
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm outline-none hover:bg-surface-hover focus-visible:bg-surface-hover"
                        >
                          <ProductPicture product={product} colour={variant.colour} className="size-9" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{product.name}</span>
                            <span className="block text-xs text-text-secondary">
                              {variantLabel(variant)} · <span className="font-mono">{variant.sku}</span>
                            </span>
                          </span>
                          <span className="text-xs text-text-secondary">{variant.stock} on shelf</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {lines.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-text-secondary">
                  Nothing on this delivery yet. Search for an item above to add it.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-background-subtle text-left text-xs text-table-header">
                      <tr>
                        <th className="px-4 py-3 font-medium">Item</th>
                        <th className="px-4 py-3 font-medium">Cost price</th>
                        <th className="px-4 py-3 font-medium">Quantity</th>
                        <th className="px-4 py-3 text-right font-medium">Line total</th>
                        <th className="w-10 px-3 py-2">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const entry = variants.get(line[lineKey]);
                        if (!entry) return null;
                        const cost = parseLeones(line.unitCost);
                        return (
                          <tr
                            key={line.variantId}
                            className={cn(
                              "border-t border-border-subtle transition-colors duration-700",
                              flash === line.variantId && "bg-primary-subtle",
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <ProductPicture product={entry.product} colour={entry.variant.colour} className="size-9" />
                                <div>
                                  <p className="font-medium">{entry.product.name}</p>
                                  <p className="text-xs text-text-secondary">
                                    {variantLabel(entry.variant)} · <span className="font-mono">{entry.variant.sku}</span>
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative w-28">
                                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-text-secondary">Le</span>
                                <Input
                                  inputMode="decimal"
                                  aria-label={`Cost price for ${entry.product.name} ${variantLabel(entry.variant)}`}
                                  value={line.unitCost}
                                  onChange={(e) =>
                                    setLines((cur) =>
                                      cur.map((l) => (l.variantId === line.variantId ? { ...l, unitCost: e.target.value } : l)),
                                    )
                                  }
                                  className="h-9 pl-7"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label="One fewer"
                                  disabled={line.quantity <= 1}
                                  onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                                >
                                  <Minus />
                                </Button>
                                <Input
                                  inputMode="numeric"
                                  aria-label={`Quantity for ${entry.product.name} ${variantLabel(entry.variant)}`}
                                  value={line.quantity}
                                  onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
                                  className="h-9 w-14 text-center"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label="One more"
                                  onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                                >
                                  <Plus />
                                </Button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular">
                              {Number.isFinite(cost) ? <Money amount={cost * line.quantity} /> : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove ${entry.product.name} ${variantLabel(entry.variant)}`}
                                onClick={() => setLines((cur) => cur.filter((l) => l.variantId !== line.variantId))}
                              >
                                <X />
                              </Button>
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

        <aside className="xl:sticky xl:top-0 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold">Delivery</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="supplier" className="text-sm font-semibold">
                  Supplier
                </Label>
                <Input
                  id="supplier"
                  list="suppliers"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Lisboa Leather Works"
                />
                <datalist id="suppliers">
                  {knownSuppliers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="batch" className="text-sm font-semibold">
                  Batch note
                </Label>
                <Textarea
                  id="batch"
                  rows={3}
                  value={batchNote}
                  onChange={(e) => setBatchNote(e.target.value)}
                  placeholder="Cartons checked, anything short or damaged…"
                />
              </div>
              <dl className="grid grid-cols-2 gap-y-1 border-t pt-4 text-sm">
                <dt className="text-text-secondary">Items</dt>
                <dd className="text-right tabular">{lines.length}</dd>
                <dt className="text-text-secondary">Units</dt>
                <dd className="text-right tabular">{totals.units}</dd>
                <dt className="font-semibold">Total cost</dt>
                <dd className="text-right font-semibold tabular">{formatMoney(totals.cost)}</dd>
              </dl>
              {error ? (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button size="lg" className="h-12" onClick={submit} disabled={create.isPending}>
                {create.isPending ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" /> Recording…
                  </>
                ) : (
                  "Record delivery"
                )}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <section aria-labelledby="recent" className="flex flex-col gap-3">
        <h2 id="recent" className="font-display text-xl font-semibold">
          Recent deliveries
        </h2>
        {intakes.isError ? (
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <PackageSearch className="size-4" aria-hidden="true" /> We couldn&apos;t load past deliveries.
          </p>
        ) : (
          <DataTable
            columns={recentColumns}
            data={[...(intakes.data ?? [])].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))}
            pageSize={5}
            pageSizeOptions={[5, 10, 25]}
            itemLabel="deliveries"
            getRowId={(i) => i.id}
            empty={{ title: "No deliveries yet", description: "Recorded deliveries will appear here." }}
          />
        )}
      </section>
    </div>
  );
}

const buildRecentColumns = (staffName: (id: string) => string): ColumnDef<StockIntake, unknown>[] => [
  { accessorKey: "reference", header: "Reference", cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
  { accessorKey: "receivedAt", header: "Received", cell: ({ getValue }) => <span className="text-text-secondary">{formatDateTime(String(getValue()))}</span> },
  { accessorKey: "supplier", header: "Supplier" },
  { id: "units", header: "Units", accessorFn: (i) => i.lines.reduce((n, l) => n + l.quantity, 0) },
  {
    id: "cost",
    header: "Total cost",
    accessorFn: (i) => i.lines.reduce((n, l) => n + l.quantity * l.unitCost, 0),
    cell: ({ getValue }) => <Money amount={Number(getValue())} />,
  },
  { id: "by", header: "Received by", accessorFn: (i) => staffName(i.receivedBy) },
  {
    accessorKey: "batchNote",
    header: "Batch note",
    enableSorting: false,
    cell: ({ getValue }) => <span className="block max-w-72 truncate text-text-secondary">{String(getValue())}</span>,
  },
];
