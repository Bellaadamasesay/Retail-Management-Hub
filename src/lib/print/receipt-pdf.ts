import type { Sale, StoreSettings } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

/** "Le 4,200" renders with a non-breaking space; the PDF's built-in font wants a plain one. */
const plain = (text: string) => text.replace(/ /g, " ");

/**
 * Builds the receipt as an 80 mm wide PDF and downloads it. jsPDF is loaded on
 * demand so it never weighs down the POS screen itself.
 */
export async function downloadReceiptPdf(sale: Sale, settings: StoreSettings | undefined, cashierName: string) {
  const { jsPDF } = await import("jspdf");
  const width = 80;
  const margin = 5;
  const lineHeight = 4.2;

  // Measure first so the page is exactly as tall as the receipt.
  const rows: { left: string; right?: string; bold?: boolean; center?: boolean; gap?: number }[] = [
    { left: settings?.storeName ?? "DaniCess Store", bold: true, center: true },
    ...(settings?.address ? [{ left: settings.address, center: true }] : []),
    ...(settings?.phone ? [{ left: settings.phone, center: true }] : []),
    { left: "", gap: 2 },
    { left: "Receipt", right: sale.receiptNumber, bold: true },
    { left: "Date", right: formatDateTime(sale.createdAt) },
    { left: "Cashier", right: cashierName },
    { left: "", gap: 2 },
    ...sale.lines.flatMap((l) => [
      { left: l.name },
      { left: `${l.quantity} x ${plain(formatMoney(l.unitPrice))}`, right: plain(formatMoney(l.quantity * l.unitPrice)) },
    ]),
    { left: "", gap: 2 },
    { left: "Total", right: plain(formatMoney(sale.total)), bold: true },
    { left: "Cash received", right: plain(formatMoney(sale.payment.tendered)) },
    { left: "Change", right: plain(formatMoney(sale.payment.change)) },
    { left: "", gap: 3 },
    { left: "Thank you for shopping with us!", center: true },
  ];
  const height = margin * 2 + rows.reduce((n, r) => n + (r.gap ?? lineHeight), 0);

  const doc = new jsPDF({ unit: "mm", format: [width, Math.max(height, 60)] });
  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);

  let y = margin + 3;
  for (const row of rows) {
    if (row.gap) {
      y += row.gap;
      continue;
    }
    doc.setFont("courier", row.bold ? "bold" : "normal");
    if (row.center) {
      doc.text(row.left, width / 2, y, { align: "center", maxWidth: width - margin * 2 });
    } else {
      doc.text(row.left, margin, y, { maxWidth: width - margin * 2 });
      if (row.right) doc.text(row.right, width - margin, y, { align: "right" });
    }
    y += lineHeight;
  }

  doc.save(`${sale.receiptNumber}.pdf`);
}
