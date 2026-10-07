/** Deterministic helpers so fixtures (and the tests that rely on them) never change between runs. */

/** Small fast seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Random = ReturnType<typeof createRandom>;

export const randomInt = (rand: Random, min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;

export const pick = <T>(rand: Random, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)];
