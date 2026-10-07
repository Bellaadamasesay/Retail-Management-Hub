import type {
  Category,
  StockIntake,
  StockTake,
  StockTakeLine,
  StockTakeStatus,
  VarianceReason,
} from "../types";
import { createRandom, pick, randomInt } from "./random";
import { allVariants, productsById } from "./products";
import { adminIds, keeperIds } from "./users";

const admin = adminIds[0];
/** The keepers take turns; with one keeper on the roster they do everything. */
const keeper = (i: number) => keeperIds[i % keeperIds.length];

const suppliers = [
  "Lisboa Leather Works",
  "Nairobi Canvas & Co.",
  "Casa Calçado Wholesale",
  "Kyoto Silk House",
];

const batchNotes = [
  "Spring restock, cartons 1–6 checked on arrival",
  "Replacement for returned batch, two pairs scuffed",
  "Short delivery: supplier to send the remainder next week",
  "Seasonal colours, tags attached",
];

const rand = createRandom(7);

export const stockIntakes: StockIntake[] = Array.from({ length: 8 }, (_, i) => {
  const lineCount = randomInt(rand, 3, 6);
  const picked = new Set<number>();
  while (picked.size < lineCount) picked.add(randomInt(rand, 0, allVariants.length - 1));
  const number = String(i + 1).padStart(3, "0");
  return {
    id: `in-${number}`,
    reference: `INT-${number}`,
    receivedAt: new Date(Date.UTC(2026, 8, 2 + i * 4, 9, 30)).toISOString(),
    supplier: pick(rand, suppliers),
    batchNote: pick(rand, batchNotes),
    receivedBy: keeper(i % 3 === 2 ? 1 : 0),
    lines: [...picked].map((idx) => ({
      variantId: allVariants[idx].id,
      quantity: randomInt(rand, 4, 12),
      unitCost: (300 + randomInt(rand, 0, 220) * 10) * 100,
    })),
  };
});

interface TakeSeed {
  n: number;
  name: string;
  scope: Category | "All";
  date: string;
  createdBy: string;
  status: StockTakeStatus;
  approvedBy?: string;
  /** Share of lines already counted (1 = finished). */
  counted: number;
  /** How many counted lines come out different from what the system expected. */
  variances: number;
}

const reasons: VarianceReason[] = ["damage", "loss", "count_error"];

/** A count sheet for everything in `scope`: mostly matching, a few discrepancies that carry a reason. */
function buildTake(seed: TakeSeed): StockTake {
  const r = createRandom(500 + seed.n);
  const inScope = allVariants.filter(
    (v) => seed.scope === "All" || productsById.get(v.productId)?.category === seed.scope,
  );
  const countedUpTo = Math.round(inScope.length * seed.counted);
  const varianceAt = new Set<number>();
  while (varianceAt.size < Math.min(seed.variances, countedUpTo)) {
    varianceAt.add(randomInt(r, 0, Math.max(countedUpTo - 1, 0)));
  }

  const lines: StockTakeLine[] = inScope.map((variant, index) => {
    const expected = variant.stock;
    if (index >= countedUpTo) return { variantId: variant.id, expected, counted: null };
    if (!varianceAt.has(index)) return { variantId: variant.id, expected, counted: expected };
    // Usually one unit short (damage or loss); occasionally one over from a miscount.
    const reason = pick(r, reasons);
    const delta = reason === "count_error" && r() < 0.5 ? 1 : -1;
    return {
      variantId: variant.id,
      expected,
      counted: Math.max(0, expected + delta),
      reason,
    };
  });

  const createdAt = `${seed.date}T08:15:00.000Z`;
  const submittedAt =
    seed.status === "pending_approval" || seed.status === "approved" ? `${seed.date}T18:30:00.000Z` : undefined;
  return {
    id: `st-${String(seed.n).padStart(3, "0")}`,
    reference: `STK-${String(seed.n).padStart(4, "0")}`,
    name: seed.name,
    scope: seed.scope,
    date: seed.date,
    createdBy: seed.createdBy,
    createdAt,
    status: seed.status,
    submittedAt,
    approvedBy: seed.approvedBy,
    approvedAt: seed.approvedBy ? `${seed.date}T19:05:00.000Z` : undefined,
    lines,
  };
}

/** Newest first: one finished and approved, one waiting for approval, one being counted, one abandoned. */
export const stockTakes: StockTake[] = [
  buildTake({ n: 5, name: "Bags section", scope: "Bags", date: "2026-10-05", createdBy: keeper(1), status: "in_progress", counted: 0.55, variances: 1 }),
  buildTake({ n: 4, name: "Accessories section", scope: "Accessories", date: "2026-10-04", createdBy: keeper(1), status: "pending_approval", counted: 1, variances: 2 }),
  buildTake({ n: 3, name: "Bags section", scope: "Bags", date: "2026-10-03", createdBy: keeper(0), status: "approved", approvedBy: admin, counted: 1, variances: 2 }),
  buildTake({ n: 2, name: "Footwear section", scope: "Shoes", date: "2026-10-01", createdBy: keeper(1), status: "cancelled", counted: 0, variances: 0 }),
  buildTake({ n: 1, name: "Accessories section", scope: "Accessories", date: "2026-09-28", createdBy: keeper(0), status: "approved", approvedBy: admin, counted: 1, variances: 1 }),
];
