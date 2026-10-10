"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PackageSearch, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/brand/empty-state";
import { DataTable } from "@/components/data/data-table";
import { FilterSelect } from "@/components/data/filter-select";
import { Money } from "@/components/data/money";
import { SearchInput } from "@/components/data/search-input";
import { ViewToggle, type ViewMode } from "@/components/data/view-toggle";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category, Product } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/date";
import { totalStock, variationSummary } from "@/lib/inventory/stock";
import { useFlip } from "@/lib/motion/use-flip";
import { Can } from "@/lib/rbac/can";
import { cn } from "@/lib/utils";
import { useProducts } from "../api/use-products";
import { filterProducts, hasFilters, NO_FILTERS, type ProductFilters } from "../lib/filter-products";
import { ImportProductsDialog } from "./import-products-dialog";
import { ProductActions } from "./product-actions";
import { ProductGrid } from "./product-grid";
import { ProductPicture } from "./product-picture";

const categoryOptions = [
  { value: "all", label: "All Categories" },
  { value: "Shoes", label: "Shoes" },
  { value: "Bags", label: "Bags" },
  { value: "Accessories", label: "Accessories" },
];

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const columns: ColumnDef<Product, unknown>[] = [
  {
    id: "image",
    header: "Image",
    enableSorting: false,
    cell: ({ row }) => (
      <ProductPicture product={row.original} flipId={row.original.id} className="size-9" />
    ),
  },
  {
    accessorKey: "name",
    header: "Product Name",
    cell: ({ row }) => (
      <Link
        href={`/products/${row.original.id}`}
        className="font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: "category", header: "Category" },
  {
    id: "variations",
    header: "Variations",
    accessorFn: (p) => p.variants.length,
    cell: ({ row }) => (
      <span className="text-text-secondary">
        {variationSummary(row.original)}
        {row.original.optionTypes.length > 0 ? (
          <span className="block text-xs">{row.original.variants.length} in all</span>
        ) : null}
      </span>
    ),
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => <Money amount={row.original.price} />,
  },
  {
    id: "stock",
    header: "Stock Level",
    accessorFn: (p) => totalStock(p),
    cell: ({ getValue }) => {
      const stock = Number(getValue());
      return (
        <span className={cn("tabular", stock === 0 && "font-medium text-destructive")}>
          {stock}
          {stock === 0 ? <span className="sr-only"> (out of stock)</span> : null}
        </span>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (p) => (p.active ? "Active" : "Inactive"),
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "success" : "destructive"}>
        {row.original.active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Last Updated",
    cell: ({ getValue }) => (
      <span className="text-text-secondary">{formatDateTime(String(getValue()))}</span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="block text-right">Actions</span>,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ProductActions product={row.original} />
      </div>
    ),
  },
];

export function ProductsView() {
  const params = useSearchParams();
  const products = useProducts();
  const [filters, setFilters] = useState<ProductFilters>({
    ...NO_FILTERS,
    query: params.get("q") ?? "",
  });
  const [view, setView] = useState<ViewMode>("table");
  const [importing, setImporting] = useState(false);

  const visible = useMemo(
    () => filterProducts(products.data ?? [], filters),
    [products.data, filters],
  );

  // Pictures glide between the table and the grid, and when filters reorder the grid.
  const { scope, capture } = useFlip<HTMLDivElement>([view, visible]);

  function update(next: Partial<ProductFilters>) {
    void capture();
    setFilters((current) => ({ ...current, ...next }));
  }

  function changeView(next: ViewMode) {
    void capture();
    setView(next);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Products"
        description="Add, edit, and manage your product catalog."
        actions={
          <Can permission="products.edit">
            <Button variant="outline" className="h-10" onClick={() => setImporting(true)}>
              <Upload aria-hidden="true" /> Import Products
            </Button>
            <Link href="/products/new" className={buttonVariants({ className: "h-10" })}>
              <Plus aria-hidden="true" /> Add Product
            </Link>
          </Can>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          value={filters.query}
          onChange={(e) => update({ query: e.target.value })}
          placeholder="Search by name, colour, size…"
          aria-label="Search products"
          className="min-w-64 flex-1 basis-80"
        />
        <FilterSelect
          label="Category"
          value={filters.category}
          onChange={(v) => update({ category: v as Category | "all" })}
          options={categoryOptions}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => update({ status: v as ProductFilters["status"] })}
          options={statusOptions}
        />
        <Button
          variant="outline"
          className="h-10"
          disabled={!hasFilters(filters)}
          onClick={() => update(NO_FILTERS)}
        >
          Clear Filters
        </Button>
        <div className="ml-auto">
          <ViewToggle value={view} onChange={changeView} />
        </div>
      </div>

      <div ref={scope}>
        {products.isPending ? (
          <TableSkeleton />
        ) : products.isError ? (
          <EmptyState
            className="bg-card"
            icon={<PackageSearch className="size-6" />}
            title="We couldn’t load the catalog"
            description="Check your connection and try again. Nothing has been lost."
            action={
              <Button size="sm" onClick={() => products.refetch()}>
                Try again
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            className="bg-card"
            icon={<PackageSearch className="size-6" />}
            title={hasFilters(filters) ? "No products match those filters" : "Nothing on the shelf yet"}
            description={
              hasFilters(filters)
                ? "Try a different name, or clear the filters."
                : "Add your first product and it will show up here, ready to sell."
            }
            action={
              hasFilters(filters) ? (
                <Button size="sm" variant="outline" onClick={() => update(NO_FILTERS)}>
                  Clear Filters
                </Button>
              ) : (
                <Can permission="products.edit">
                  <Link href="/products/new" className={buttonVariants({ size: "sm" })}>
                    Add a product
                  </Link>
                </Can>
              )
            }
          />
        ) : view === "table" ? (
          <DataTable
            columns={columns}
            data={visible}
            selectable
            pageSize={8}
            itemLabel="products"
            getRowId={(p) => p.id}
          />
        ) : (
          <ProductGrid products={visible} />
        )}
      </div>

      <ImportProductsDialog open={importing} onOpenChange={setImporting} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card" aria-busy="true" aria-label="Loading products">
      <Skeleton className="h-10 w-full rounded-none" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t px-3 py-3">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="size-9" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
