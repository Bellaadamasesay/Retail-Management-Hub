/** Minimal CSV reading and writing (RFC 4180 quoting), used by product import and report export. */

export type CsvRow = string[];

/** Parses CSV text into rows. Handles quoted fields, doubled quotes, CRLF and a trailing newline. */
export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function escapeCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows to CSV text with CRLF line breaks (what spreadsheet apps expect). */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

/** Triggers a browser download of CSV text. */
export function downloadCsv(filename: string, rows: readonly (readonly (string | number)[])[]) {
  // A BOM keeps Excel from mangling non-ASCII text.
  const blob = new Blob(["\uFEFF", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
