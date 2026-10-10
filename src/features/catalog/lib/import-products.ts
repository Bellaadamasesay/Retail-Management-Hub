import { parseCsv } from "@/lib/csv";
import { parseLeones } from "@/lib/format/money";
import type { Category, ProductInput } from "@/lib/api/types";
import { combinations, optionsOf, type VariationType } from "./variants";

/** Columns of the import file, in template order. Prices are in Leones; lists use "|". */
export const IMPORT_COLUMNS = [
  "name",
  "category",
  "price",
  "cost",
  "colours",
  "sizes",
  "quantity",
  "reorder_threshold",
  "description",
] as const;

export const TEMPLATE_ROWS: string[][] = [
  [...IMPORT_COLUMNS],
  ["Leather Belt", "Accessories", "1300", "450", "Black|Brown", "S|M|L", "4", "3", "Hand-stitched belt with a brass buckle."],
  ["Court Sneaker", "Shoes", "3300", "1350", "White|Navy", "38-46", "2", "3", "Clean low-top sneaker."],
  ["Travel Mug", "Accessories", "450", "180", "", "", "12", "4", "Sold in one version: leave colours and sizes empty."],
];

const CATEGORIES: Category[] = ["Shoes", "Bags", "Accessories"];

export interface ImportRow {
  /** 1-based line in the file (the header is line 1). */
  line: number;
  name: string;
  input?: ProductInput;
  error?: string;
}

export interface ImportPreview {
  rows: ImportRow[];
  /** Header columns the file lacks. When non-empty nothing can be imported. */
  missingColumns: string[];
}

/** "36-45" -> 36..45; "S|M|L" -> S, M, L; empty or "One size" -> no sizes. Null when unreadable. */
export function parseSizes(text: string): string[] | null {
  const value = text.trim();
  if (!value || value.toLowerCase() === "one size") return [];
  const range = value.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])];
    if (from > to || to - from > 30) return null;
    return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  }
  return value.split("|").map((s) => s.trim()).filter(Boolean);
}

const unique = (items: string[]) => [...new Set(items)];

/** Reads the CSV text into validated product inputs. Every variation starts with the row's quantity. */
export function parseProductImport(text: string): ImportPreview {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], missingColumns: [...IMPORT_COLUMNS] };

  const columns = header.map((h) => h.trim().toLowerCase());
  const required = ["name", "category", "price", "cost"];
  const missingColumns = required.filter((c) => !columns.includes(c));
  if (missingColumns.length) return { rows: [], missingColumns };

  const cell = (row: string[], name: string) => (columns.includes(name) ? (row[columns.indexOf(name)] ?? "").trim() : "");

  const rows = body.map<ImportRow>((row, index) => {
    const line = index + 2;
    const name = cell(row, "name");
    const fail = (error: string): ImportRow => ({ line, name: name || `Line ${line}`, error });

    if (!name) return fail("Missing a product name.");
    const category = CATEGORIES.find((c) => c.toLowerCase() === cell(row, "category").toLowerCase());
    if (!category) return fail(`Category must be Shoes, Bags or Accessories (got “${cell(row, "category")}”).`);

    const price = parseLeones(cell(row, "price"));
    const cost = parseLeones(cell(row, "cost"));
    if (!Number.isFinite(price) || price <= 0) return fail("Price must be a number above zero (in Leones).");
    if (!Number.isFinite(cost) || cost < 0) return fail("Cost must be a number (in Leones).");

    const colours = unique(cell(row, "colours").split("|").map((c) => c.trim()).filter(Boolean));
    const sizes = parseSizes(cell(row, "sizes"));
    if (sizes === null) return fail("Sizes should look like 36-45, S|M|L, or be left empty.");

    const quantityText = cell(row, "quantity") || "0";
    if (!/^\d+$/.test(quantityText)) return fail("Quantity must be a whole number.");
    const stock = Number(quantityText);

    const reorder = Number.parseInt(cell(row, "reorder_threshold") || "3", 10);
    if (!Number.isInteger(reorder) || reorder < 0) return fail("Reorder threshold must be a whole number.");

    const types: VariationType[] = [
      ...(colours.length ? [{ name: "Colour", values: colours }] : []),
      ...(sizes.length ? [{ name: "Size", values: unique(sizes) }] : []),
    ];
    const variants =
      types.length === 0
        ? [{ options: {}, stock, reorderThreshold: reorder }]
        : combinations(types).map((values) => ({ options: optionsOf(types, values), stock, reorderThreshold: reorder }));

    return {
      line,
      name,
      input: {
        name,
        category,
        description: cell(row, "description"),
        price,
        cost,
        active: true,
        image: null,
        optionTypes: types.map((t) => t.name),
        variants,
      },
    };
  });

  return { rows, missingColumns: [] };
}
