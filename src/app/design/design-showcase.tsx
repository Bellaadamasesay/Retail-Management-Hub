"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Package, PackageSearch, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/brand/empty-state";
import { ProductThumb, type ProductShape } from "@/components/brand/product-thumb";
import { DataTable } from "@/components/data/data-table";
import { Money } from "@/components/data/money";
import { StatCard } from "@/components/data/stat-card";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStaggerIn } from "@/lib/motion/use-stagger-in";

export interface LowStockRow {
  id: string;
  name: string;
  stock: number;
  threshold: number;
}

interface DesignShowcaseProps {
  stats: { salesToday: number; itemsToday: number; lowStockCount: number };
  lowStock: LowStockRow[];
}

const swatches = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["surface-raised", "bg-surface-raised"],
  ["primary", "bg-primary"],
  ["primary-subtle", "bg-primary-subtle"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["destructive", "bg-destructive"],
  ["info", "bg-info"],
  ["chart-1 Forest", "bg-chart-1"],
  ["chart-2 Clay", "bg-chart-2"],
  ["chart-3 Ochre", "bg-chart-3"],
  ["chart-4 Sage", "bg-chart-4"],
  ["chart-5 Teal", "bg-chart-5"],
  ["chart-6 Cocoa", "bg-chart-6"],
  ["product-bg", "bg-product-bg"],
] as const;

const gallery: [ProductShape, string][] = [
  ["tote", "Cognac"], ["satchel", "Black"], ["duffel", "Olive"], ["clutch", "Blush"], ["backpack", "Navy"],
  ["sneaker", "White"], ["oxford", "Tan"], ["boot", "Sand"], ["heel", "Nude"], ["sandal", "Brown"],
  ["belt", "Black"], ["cardholder", "Burgundy"], ["scarf", "Floral"],
];

const lowStockColumns: ColumnDef<LowStockRow, unknown>[] = [
  { accessorKey: "name", header: "Product" },
  {
    accessorKey: "stock",
    header: "On shelf",
    cell: ({ row }) =>
      row.original.stock === 0 ? (
        <Badge variant="destructive">Sold out</Badge>
      ) : (
        <Badge variant="warning">
          {row.original.stock} left
        </Badge>
      ),
  },
  { accessorKey: "threshold", header: "Reorder at" },
];

export function DesignShowcase({ stats, lowStock }: DesignShowcaseProps) {
  const statGrid = useStaggerIn();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Design system</p>
          <h1 className="font-display text-4xl">Tokens, components, motion</h1>
        </div>
        <ThemeToggle />
      </header>

      <section aria-labelledby="colour" className="flex flex-col gap-3">
        <h2 id="colour" className="text-2xl">
          Colour
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {swatches.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className={`${cls} h-16 rounded-lg border`} />
              <span className="text-sm text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="pictures" className="flex flex-col gap-3">
        <h2 id="pictures" className="text-2xl">
          Product pictures
        </h2>
        <div className="flex flex-wrap gap-3">
          {gallery.map(([shape, colour]) => (
            <ProductThumb key={shape} shape={shape} colour={colour} label={`${colour} ${shape}`} className="size-24" />
          ))}
        </div>
      </section>

      <section aria-labelledby="counters" className="flex flex-col gap-3">
        <h2 id="counters" className="text-2xl">
          Counting stat cards
        </h2>
        <div ref={statGrid} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Today's sales"
            kind="money"
            icon={ShoppingBag}
            accent="forest"
            value={stats.salesToday}
            delta={{ percent: 12, label: "from yesterday" }}
            trend={[3, 4, 3.5, 5, 4.6, 6, 7.2]}
          />
          <StatCard
            label="Items sold"
            icon={Package}
            accent="sage"
            value={stats.itemsToday}
            delta={{ percent: 8, label: "from yesterday" }}
            trend={[5, 4, 6, 5.5, 7, 6.5, 8]}
          />
          <StatCard
            label="Running low"
            icon={AlertTriangle}
            accent="ochre"
            value={stats.lowStockCount}
            delta={{ percent: -5, label: "from last month" }}
            trend={[8, 7, 7.5, 6, 6.4, 5, 4.8]}
          />
          <StatCard
            label="Variants tracked"
            icon={Package}
            accent="clay"
            value={stats.itemsToday * 14}
            hint="Across every product"
          />
        </div>
      </section>

      <section aria-labelledby="table" className="flex flex-col gap-3">
        <h2 id="table" className="text-2xl">
          Data table
        </h2>
        <DataTable
          columns={lowStockColumns}
          data={lowStock}
          empty={{
            title: "Everything is well stocked",
            description: "Nothing is at or under its reorder point right now.",
          }}
        />
      </section>

      <section aria-labelledby="buttons" className="flex flex-col gap-3">
        <h2 id="buttons" className="text-2xl">
          Buttons, money and toasts
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Receipt total</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Money amount={189_900} className="mr-4 text-3xl font-semibold" />
            <Button
              onClick={() =>
                toast.success("Nice sale! Receipt is ready.", {
                  description: "RC-1482 · Le 1,899 · Cash, Le 101 change",
                })
              }
            >
              Complete sale
            </Button>
            <Button variant="secondary">Hold</Button>
            <Button variant="outline">Print</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Void</Button>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="empty" className="flex flex-col gap-3">
        <h2 id="empty" className="text-2xl">
          Empty state
        </h2>
        <EmptyState
          icon={<PackageSearch className="size-6" />}
          title="Nothing on the shelf yet"
          description="Add your first product and it will show up here, ready to sell."
          action={<Button size="sm">Add a product</Button>}
        />
      </section>
    </main>
  );
}
