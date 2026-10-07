import type { Category, Product, Variant } from "../types";
import { createRandom, randomInt } from "./random";

interface ProductSeed {
  code: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  cost: number;
  colours: string[];
  sizes: string[];
  reorderThreshold: number;
}

const shoeSizes = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

const seeds: ProductSeed[] = [
  { code: "OXB", name: "Oxford Brogue", category: "Shoes", description: "Full-grain leather brogue with a stacked leather sole.", price: 420000, cost: 185000, colours: ["Black", "Tan"], sizes: shoeSizes(40, 45), reorderThreshold: 2 },
  { code: "SCB", name: "Suede Chelsea Boot", category: "Shoes", description: "Soft suede boot with elastic gussets and a pull tab.", price: 480000, cost: 215000, colours: ["Sand", "Charcoal"], sizes: shoeSizes(39, 45), reorderThreshold: 2 },
  { code: "ELS", name: "Everyday Leather Sneaker", category: "Shoes", description: "Clean low-top sneaker, cushioned insole.", price: 330000, cost: 135000, colours: ["White", "Navy"], sizes: shoeSizes(38, 46), reorderThreshold: 3 },
  { code: "SBH", name: "Strappy Block Heel", category: "Shoes", description: "Comfortable 6 cm block heel with an adjustable ankle strap.", price: 290000, cost: 120000, colours: ["Nude", "Black"], sizes: shoeSizes(36, 41), reorderThreshold: 2 },
  { code: "CSO", name: "Canvas Slip-on", category: "Shoes", description: "Lightweight canvas slip-on for warm days.", price: 180000, cost: 70000, colours: ["Olive", "Cream"], sizes: shoeSizes(36, 44), reorderThreshold: 3 },
  { code: "LSD", name: "Leather Sandal", category: "Shoes", description: "Hand-stitched leather sandal with a cork footbed.", price: 200000, cost: 80000, colours: ["Tan", "Black"], sizes: shoeSizes(36, 45), reorderThreshold: 3 },
  { code: "LTB", name: "Leather Tote Bag", category: "Bags", description: "Roomy structured tote with an inner zip pocket.", price: 550000, cost: 250000, colours: ["Black", "Brown", "Tan"], sizes: ["One size"], reorderThreshold: 3 },
  { code: "CBS", name: "Crossbody Satchel", category: "Bags", description: "Compact satchel with an adjustable shoulder strap.", price: 400000, cost: 170000, colours: ["Cognac", "Black"], sizes: ["One size"], reorderThreshold: 3 },
  { code: "WKD", name: "Weekender Duffel", category: "Bags", description: "Waxed canvas duffel with leather handles.", price: 650000, cost: 280000, colours: ["Olive", "Black"], sizes: ["One size"], reorderThreshold: 2 },
  { code: "MCL", name: "Mini Clutch", category: "Bags", description: "Evening clutch with a detachable chain.", price: 200000, cost: 75000, colours: ["Gold", "Black", "Blush"], sizes: ["One size"], reorderThreshold: 3 },
  { code: "CBP", name: "Canvas Backpack", category: "Bags", description: "Everyday backpack with a padded laptop sleeve.", price: 300000, cost: 120000, colours: ["Navy", "Grey"], sizes: ["One size"], reorderThreshold: 3 },
  { code: "BLT", name: "Braided Leather Belt", category: "Accessories", description: "Hand-braided belt with a brushed brass buckle.", price: 130000, cost: 45000, colours: ["Black", "Brown"], sizes: ["S", "M", "L"], reorderThreshold: 3 },
  { code: "CRH", name: "Card Holder", category: "Accessories", description: "Slim leather card holder, six slots.", price: 90000, cost: 30000, colours: ["Black", "Tan", "Burgundy"], sizes: ["One size"], reorderThreshold: 4 },
  { code: "SSC", name: "Silk Scarf", category: "Accessories", description: "Printed silk twill scarf, 70 cm square.", price: 110000, cost: 40000, colours: ["Floral", "Stripe"], sizes: ["One size"], reorderThreshold: 3 },
];

const colourCode = (colour: string) => colour.slice(0, 3).toUpperCase();
const sizeCode = (size: string) => (size === "One size" ? "OS" : size);

function buildProduct(seed: ProductSeed, index: number): Product {
  const rand = createRandom(1000 + index);
  const productId = `p-${seed.code.toLowerCase()}`;

  const variants: Variant[] = seed.colours.flatMap((colour) =>
    seed.sizes.map((size) => {
      // Uneven stock: a few sold out, a handful low, the rest healthy.
      const roll = rand();
      const stock =
        roll < 0.03 ? 0 : roll < 0.09 ? randomInt(rand, 1, seed.reorderThreshold) : randomInt(rand, 5, 14);
      return {
        id: `${productId}-${colourCode(colour)}-${sizeCode(size)}`.toLowerCase(),
        productId,
        sku: `${seed.code}-${colourCode(colour)}-${sizeCode(size)}`,
        colour,
        size,
        stock,
        reorderThreshold: seed.reorderThreshold,
      };
    }),
  );

  const createdAt = new Date(Date.UTC(2026, 0, 12 + index * 3)).toISOString();
  // Last edited somewhere in the final fortnight; spread by index so the list sorts believably.
  const updatedAt = new Date(Date.UTC(2026, 8, 21 + (index % 14), 8 + (index % 9), (index * 7) % 60)).toISOString();

  return {
    id: productId,
    code: seed.code,
    name: seed.name,
    category: seed.category,
    description: seed.description,
    price: seed.price,
    cost: seed.cost,
    variants,
    // The old Canvas Slip-on line is being phased out, so one product is inactive.
    active: seed.code !== "CSO",
    createdAt,
    updatedAt,
  };
}

export const products: Product[] = seeds.map(buildProduct);

export const allVariants: Variant[] = products.flatMap((p) => p.variants);

export const variantsById = new Map(allVariants.map((v) => [v.id, v]));
export const productsById = new Map(products.map((p) => [p.id, p]));
