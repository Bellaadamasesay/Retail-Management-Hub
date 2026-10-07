"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/brand/empty-state";
import { TablePagination } from "@/components/data/table-pagination";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStaggerIn } from "@/lib/motion/use-stagger-in";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Shown when `data` is empty. */
  empty?: { title: string; description: string; action?: ReactNode };
  className?: string;
  /** Adds a leading checkbox column with select-all. */
  selectable?: boolean;
  /** Rows per page. Omit to show every row without a pager. */
  pageSize?: number;
  pageSizeOptions?: number[];
  /** Plural noun for "Showing 1 to 8 of 245 products". */
  itemLabel?: string;
  getRowId?: (row: TData, index: number) => string;
  /** Called with the selected rows whenever the selection changes. */
  onSelectionChange?: (rows: TData[]) => void;
  /** Extra classes per row (e.g. to highlight a freshly added line). */
  rowClassName?: (row: TData) => string | undefined;
}

export function DataTable<TData>({
  columns,
  data,
  empty,
  className,
  selectable = false,
  pageSize,
  pageSizeOptions = [5, 8, 10, 25, 50],
  itemLabel = "items",
  getRowId,
  onSelectionChange,
  rowClassName,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: pageSize ?? Number.MAX_SAFE_INTEGER });
  const body = useStaggerIn<HTMLTableSectionElement>({
    selector: "[data-row]",
    y: 8,
    dependencies: [data.length > 0],
  });

  const allColumns = useMemo<ColumnDef<TData, unknown>[]>(
    () =>
      selectable
        ? [
            {
              id: "select",
              enableSorting: false,
              header: ({ table }) => (
                <Checkbox
                  aria-label="Select all rows"
                  checked={table.getIsAllPageRowsSelected()}
                  indeterminate={table.getIsSomePageRowsSelected()}
                  onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
                />
              ),
              cell: ({ row }) => (
                <Checkbox
                  aria-label="Select row"
                  checked={row.getIsSelected()}
                  onCheckedChange={(checked) => row.toggleSelected(checked === true)}
                />
              ),
            },
            ...columns,
          ]
        : columns,
    [columns, selectable],
  );

  // TanStack Table returns functions that the React Compiler can't memoise safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, rowSelection: selection, pagination },
    getRowId,
    enableRowSelection: selectable,
    onSortingChange: setSorting,
    onRowSelectionChange: setSelection,
    onPaginationChange: setPagination,
    // First click sorts ascending for every column (the library defaults numbers to descending).
    sortDescFirst: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  const reportSelection = useEffectEvent(() => {
    onSelectionChange?.(table.getSelectedRowModel().rows.map((r) => r.original));
  });
  useEffect(() => {
    reportSelection();
  }, [selection]);

  // A filtered list can shrink below the current page: pull back to the last page that exists.
  const pageCount = table.getPageCount();
  useEffect(() => {
    if (pagination.pageIndex > 0 && pagination.pageIndex >= pageCount) {
      setPagination((p) => ({ ...p, pageIndex: Math.max(0, pageCount - 1) }));
    }
  }, [pageCount, pagination.pageIndex]);

  if (data.length === 0 && empty) {
    return <EmptyState className={className} {...empty} />;
  }

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const direction = header.column.getIsSorted();
                  const isSelect = header.column.id === "select";
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(isSelect && "w-10")}
                      aria-sort={
                        direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {direction === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : direction === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody ref={body}>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-row
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={rowClassName?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pageSize ? (
        <TablePagination
          page={pagination.pageIndex}
          pageSize={pagination.pageSize}
          totalItems={data.length}
          pageSizeOptions={pageSizeOptions.includes(pageSize) ? pageSizeOptions : [pageSize, ...pageSizeOptions]}
          itemLabel={itemLabel}
          onPageChange={(pageIndex) => setPagination((p) => ({ ...p, pageIndex }))}
          onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
        />
      ) : null}
    </div>
  );
}
