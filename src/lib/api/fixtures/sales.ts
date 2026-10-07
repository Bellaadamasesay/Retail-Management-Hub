import type { Sale } from "../types";
import { allVariants, productsById } from "./products";
import { cashierIds } from "./users";
import { createRandom, pick, randomInt } from "./random";

import { FIXTURE_NOW } from "./now";
export { FIXTURE_NOW };

const DAYS = 21;

/** Relative weight of each trading hour (10:00–19:00): lunch and after-work peaks. */
const hourWeights: Record<number, number> = {
  10: 2, 11: 3, 12: 6, 13: 6, 14: 3, 15: 3, 16: 4, 17: 7, 18: 7, 19: 3,
};
const hours = Object.keys(hourWeights).map(Number);
const weightedHours = hours.flatMap((h) => Array<number>(hourWeights[h]).fill(h));

/** Customers hand over notes: round the total up to a common denomination (or pay exact): Le 10, 50, 100 or 200 notes. */
const roundingSteps = [1, 1000, 5000, 5000, 10000, 20000];

export const sales: Sale[] = (() => {
  const rand = createRandom(42);
  const result: Sale[] = [];
  let receipt = 1000;

  for (let d = DAYS - 1; d >= 0; d--) {
    const day = new Date(FIXTURE_NOW);
    day.setUTCDate(day.getUTCDate() - d);
    const weekend = [0, 6].includes(day.getUTCDay());
    const count = randomInt(rand, weekend ? 18 : 9, weekend ? 28 : 16);

    const daySales: Sale[] = [];
    for (let i = 0; i < count; i++) {
      const lineCount = rand() < 0.75 ? 1 : randomInt(rand, 2, 3);
      const lines = Array.from({ length: lineCount }, () => {
        const variant = pick(rand, allVariants);
        const product = productsById.get(variant.productId)!;
        return {
          variantId: variant.id,
          name: `${product.name} · ${variant.colour}${variant.size === "One size" ? "" : ` · ${variant.size}`}`,
          sku: variant.sku,
          quantity: rand() < 0.9 ? 1 : 2,
          unitPrice: product.price,
        };
      });
      const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

      const step = pick(rand, roundingSteps);
      const tendered = Math.ceil(total / step) * step;

      const at = new Date(day);
      at.setUTCHours(pick(rand, weightedHours), randomInt(rand, 0, 59), randomInt(rand, 0, 59), 0);
      if (at > FIXTURE_NOW) continue;

      daySales.push({
        id: "",
        receiptNumber: "",
        createdAt: at.toISOString(),
        cashierId: pick(rand, cashierIds),
        lines,
        total,
        payment: { tendered, change: tendered - total },
      });
    }

    daySales.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const sale of daySales) {
      receipt += 1;
      sale.id = `s-${receipt}`;
      sale.receiptNumber = `RC-${receipt}`;
      result.push(sale);
    }
  }
  return result;
})();
