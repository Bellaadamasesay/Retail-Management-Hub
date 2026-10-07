import { parseCsv } from "@/lib/csv";
import { parseLeones } from "@/lib/format/money";
import type { Category, ProductInput } from "@/lib/api/types";
import { deriveProductCode, generateVariants, ONE_SIZE } from "./variants";

/** Columns of the import file, in template order. Prices are in Leones; lists use "|". */
export const IMPORT_COLUMNS = [
  "name",
  "category",
  "price",
  "cost",
  "colours",
  "sizes",
  "reorder_threshold",
  "description",
] as const;

export const TEMPLATE_ROWS: string[][] = [
  [...IMPORT_COLUMNS],
  ["Leather Belt", "Accessories", "1300", "450", "Black|Brown", "S|M|L", "3", "Hand-stitched belt with a brass buckle."],
  ["Court Sneaker", "Shoes", "3300", "1350", "White|Navy", "38-46", "3", "Clean low-top sneaker."],
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

/** "36-45" -> 36..45; "S|M|L" -> S, M, L; empty or "One size" -> One size. */
export function parseSizes(text: string): string[] {
  const value = text.trim();
  if (!value || value.toLowerCase() === ONE_SIZE.toLowerCase()) return [ONE_SIZE];
  const range = value.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])];
    if (from > to || to - from > 30) return [];
    return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  }
  return value.split("|").map((s) => s.trim()).filter(Boolean);
}

const unique = (items: string[]) => [...new Set(items)];

interface Context {
  existingCodes: readonly string[];
}

/** Reads the CSV text into validated product inputs, generating codes and SKUs. */
export function parseProductImport(text: string, { existingCodes }: Context): ImportPreview {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], missingColumns: [...IMPORT_COLUMNS] };

  const columns = header.map((h) => h.trim().toLowerCase());
  const required = ["name", "category", "price", "cost", "colours"];
  const missingColumns = required.filter((c) => !columns.includes(c));
  if (missingColumns.length) return { rows: [], missingColumns };

  const cell = (row: string[], name: string) => (row[columns.indexOf(name)] ?? "").trim();
  const codes = [...existingCodes];

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
    if (colours.length === 0) return fail("Add at least one colour, e.g. Black|Tan.");
    const sizes = unique(parseSizes(cell(row, "sizes")));
    if (sizes.length === 0) return fail("Sizes should look like 36-45, S|M|L or One size.");

    const reorder = Number.parseInt(cell(row, "reorder_threshold") || "3", 10);
    if (!Number.isInteger(reorder) || reorder < 0) return fail("Reorder threshold must be a whole number.");

    const code = deriveProductCode(name, codes);
    const variants = generateVariants({
      productCode: code,
      colours,
      sizes,
      reorderThreshold: reorder,
    });
    codes.push(code);

    return {
      line,
      name,
      input: {
        code,
        name,
        category,
        description: cell(row, "description"),
        price,
        cost,
        active: true,
        variants,
      },
    };
  });

  return { rows, missingColumns: [] };
}
