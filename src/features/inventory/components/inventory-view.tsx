"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Boxes, Download, Eye, MoreHorizontal, PackageCheck, PackagePlus, PackageSearch, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/brand/empty-state";
import { DataTable } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { Money } from "@/components/data/money";
import { SearchInput } from "@/components/data/search-input";
import { StatCard } from "@/components/data/stat-card";
import { StockStatusBadge } from "@/components/data/stock-status-badge";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermission } from "@/lib/rbac/use-permission";
import { ProductPicture } from "@/features/catalog/components/product-picture";
import { useProducts } from "@/features/catalog/api/use-products";
import type { Category, Product, Variant } from "@/lib/api/types";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format/date";
import { statusLabel, variantLabel, variantStatus, type StockStatus } from "@/lib/inventory/stock";
import { useStaggerIn } from "@/lib/motion/use-stagger-in";
import { Can } from "@/lib/rbac/can";
import { cn } from "@/lib/utils";
import { useMovements } from "../api/use-intakes";

interface Row {
  variant: Variant;
  product: Product;
  status: StockStatus;
  updatedAt: string;
}

const categoryOptions = [
  { value: "all", label: "All Categories" },
  { value: "Shoes", label: "Shoes" },
  { value: "Bags", label: "Bags" },
  { value: "Accessories", label: "Accessories" },
];

const statusOptions = [
  { value: "all", label: "All Stock Status" },
  { value: "in", label: "In Stock" },
  { value: "low", label: "Low Stock" },
  { value: "out", label: "Out of Stock" },
];

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: "product",
    header: "Product",
    accessorFn: (r) => `${r.product.name} ${variantLabel(r.variant)}`,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <ProductPicture product={row.original.product} colour={row.original.variant.colour} className="size-10" />
        <div className="min-w-0">
          <Link
            href={`/products/${row.original.product.id}`}
            className="block font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {row.original.product.name}
          </Link>
          <span className="block text-xs text-text-secondary">{variantLabel(row.original.variant)}</span>
        </div>
      </div>
    ),
  },
  {
    id: "sku",
    header: "SKU",
    accessorFn: (r) => r.variant.sku,
    cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span>,
  },
  { id: "category", header: "Category", accessorFn: (r) => r.product.category },
  {
    id: "stock",
    header: "Stock Level",
    accessorFn: (r) => r.variant.stock,
    cell: ({ getValue }) => {
      const stock = Number(getValue());
      return <span className={cn("tabular", stock === 0 && "font-medium text-destructive")}>{stock}</span>;
    },
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (r) => statusLabel[r.status],
    cell: ({ row }) => <StockStatusBadge status={row.original.status} />,
  },
  {
    id: "price",
    header: "Unit Price",
    accessorFn: (r) => r.product.price,
    cell: ({ row }) => <Money amount={row.original.product.price} />,
  },
  {
    id: "updated",
    header: "Last Updated",
    accessorFn: (r) => r.updatedAt,
    cell: ({ row }) => <span className="text-text-secondary">{formatDateTime(row.original.updatedAt)}</span>,
  },
  {
    id: "actions",
    header: () => <span className="block text-right">Actions</span>,
    enableSorting: false,
    cell: ({ row }) => <RowActions row={row.original} />,
  },
];

function RowActions({ row }: { row: Row }) {
  const canReceive = usePermission("inventory.intake");
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${row.product.name} ${variantLabel(row.variant)}`}
          className="grid size-8 place-items-center rounded-md border border-border bg-card outline-none hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem render={<Link href={`/products/${row.product.id}`} />}>
            <Eye aria-hidden="true" /> View product
          </DropdownMenuItem>
          {canReceive ? (
            <DropdownMenuItem render={<Link href={`/inventory/intake?variant=${row.variant.id}`} />}>
              <PackagePlus aria-hidden="true" /> Receive stock
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Stock levels per variant (SKU). Everyone with inventory access sees quantities; only Keepers and Admins get actions. */
export function InventoryView() {
  const products = useProducts();
  const movements = useMovements();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const cards = useStaggerIn<HTMLDivElement>();

  const rows = useMemo<Row[]>(() => {
    const latest = new Map<string, string>();
    for (const m of movements.data ?? []) {
      if (!latest.has(m.variantId) || m.at > latest.get(m.variantId)!) latest.set(m.variantId, m.at);
    }
    return (products.data ?? []).flatMap((product) =>
      product.variants.map((variant) => ({
        variant,
        product,
        status: variantStatus(variant),
        updatedAt: latest.get(variant.id) ?? product.updatedAt,
      })),
    );
  }, [products.data, movements.data]);

  const counts = useMemo(
    () => ({
      products: products.data?.length ?? 0,
      variants: rows.length,
      in: rows.filter((r) => r.status === "in").length,
      low: rows.filter((r) => r.status === "low").length,
      out: rows.filter((r) => r.status === "out").length,
    }),
    [products.data, rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "all" && r.product.category !== (category as Category)) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        r.product.name.toLowerCase().includes(q) || r.variant.sku.toLowerCase().includes(q)
      );
    });
  }, [rows, query, category, status]);

  const filtered = query.trim() !== "" || category !== "all" || status !== "all";
  const loading = products.isPending || movements.isPending;

  function clear() {
    setQuery("");
    setCategory("all");
    setStatus("all");
  }

  function exportCsv() {
    downloadCsv("retailhub-inventory.csv", [
      ["Product", "Variant", "SKU", "Category", "Stock", "Reorder at", "Status", "Unit price (Le)", "Last updated"],
      ...visible.map((r) => [
        r.product.name,
        variantLabel(r.variant),
        r.variant.sku,
        r.product.category,
        r.variant.stock,
        r.variant.reorderThreshold,
        statusLabel[r.status],
        r.product.price / 100,
        r.updatedAt,
      ]),
    ]);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Inventory"
        description="Manage your stock, view levels, and track inventory across all products."
        actions={
          <>
            <Can permission="inventory.intake">
              <Link href="/inventory/intake" className={buttonVariants({ variant: "outline", className: "h-10" })}>
                <PackagePlus aria-hidden="true" /> Receive stock
              </Link>
            </Can>
            <Can permission="products.edit">
              <Link href="/products/new" className={buttonVariants({ className: "h-10" })}>
                <Plus aria-hidden="true" /> Add Product
              </Link>
            </Can>
          </>
        }
      />

      <div ref={cards} className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Products" value={counts.products} icon={Boxes} accent="forest" hint={`${counts.variants} variants across them`} />
        <StatCard label="In Stock" value={counts.in} icon={PackageCheck} accent="sage" hint="Variants above their reorder point" />
        <StatCard label="Low Stock" value={counts.low} icon={TriangleAlert} accent="ochre" hint="At or under the reorder point" />
        <StatCard label="Out of Stock" value={counts.out} icon={Ban} accent="clay" hint="Nothing left on the shelf" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products by name or SKU…"
          aria-label="Search inventory"
          className="min-w-64 flex-1 basis-80"
        />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={categoryOptions} />
        <FilterSelect label="Stock status" value={status} onChange={setStatus} options={statusOptions} />
        <Button variant="outline" className="h-10" disabled={!filtered} onClick={clear}>
          Clear Filters
        </Button>
        <Button variant="outline" className="ml-auto h-10" disabled={visible.length === 0} onClick={exportCsv}>
          <Download aria-hidden="true" /> Export
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading inventory">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : products.isError ? (
        <EmptyState
          className="bg-card"
          icon={<PackageSearch className="size-6" />}
          title="We couldn’t load the stock levels"
          description="Check your connection and try again. Nothing has been lost."
          action={
            <Button size="sm" onClick={() => products.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          selectable
          pageSize={8}
          itemLabel="variants"
          getRowId={(r) => r.variant.id}
          empty={{
            title: filtered ? "No stock matches those filters" : "No stock to show yet",
            description: filtered
              ? "Try a different name or SKU, or clear the filters."
              : "Add a product, then record a delivery to see stock levels here.",
          }}
        />
      )}
    </div>
  );
}
