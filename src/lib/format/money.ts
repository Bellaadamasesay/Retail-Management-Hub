/**
 * Money is stored as integer minor units (1 Leone = 100 cents) everywhere and
 * only converted for display here, so totals never suffer float drift.
 *
 * The store trades in Sierra Leonean Leone (new Leone, ISO code SLE), written
 * "Le". The symbol is composed by hand because Intl does not render "Le"
 * reliably across browsers.
 */
export const CURRENCY = { code: "SLE", symbol: "Le" } as const;

const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "en-SL";
const MINOR_UNITS = 2;
export const MINOR_FACTOR = 10 ** MINOR_UNITS;

const whole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: MINOR_UNITS,
  maximumFractionDigits: MINOR_UNITS,
});

/** Non-breaking space keeps "Le" and the amount on one line. */
const NBSP = " ";

/**
 * 420000 -> "Le 4,200"; 1250 -> "Le 12.50". Whole Leones show no decimals;
 * cents only appear when there are some. Accepts fractional values so animated
 * counters can pass tween values.
 */
export function formatMoney(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const hasCents = Math.round(abs) % MINOR_FACTOR !== 0;
  const text = (hasCents ? withCents : whole).format(abs / MINOR_FACTOR);
  return `${sign}${CURRENCY.symbol}${NBSP}${text}`;
}

/** "12.50" -> 1250. Returns NaN for unparseable input. */
export function toMinorUnits(amount: string | number): number {
  const value = typeof amount === "number" ? amount : Number.parseFloat(amount);
  return Math.round(value * MINOR_FACTOR);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(Math.round(value));
}

/** Reads what a person types into a Leone field ("4,200", "12.50", "Le 300") as minor units. NaN if unreadable. */
export function parseLeones(text: string): number {
  const cleaned = text.replace(/^\s*Le\s*/i, "").replace(/[,\s\u00a0]/g, "");
  if (cleaned === "" || !/^\d*\.?\d+$/.test(cleaned)) return Number.NaN;
  return toMinorUnits(cleaned);
}
