import { DatabaseSync } from 'node:sqlite';
import { CATALOG } from './catalog-spec';
import { PLATFORMS } from './platforms-spec';

export interface SeedOptions {
  count?: number; // how many products to keep (capped at the number of combinations the spec can make)
  seed?: number;  // same seed → same data every time
}

/** Fills empty tables with SAMPLE products and per-store prices. Returns how many rows were written. */
export function seedCatalog(db: DatabaseSync, { count = 1000, seed = 42 }: SeedOptions = {}) {
  const random = mulberry32(seed);
  const between = (min: number, max: number) => min + random() * (max - min);

  // 1. Every brand × variant × size combination, then a repeatable random subset of `count`
  const combos = CATALOG.flatMap(spec =>
    spec.brands.flatMap(([brand, brandMult]) =>
      (spec.variants ?? [['', 1] as [string, number]]).flatMap(([variant, variantMult]) =>
        spec.sizes.map(size => ({ spec, brand, variant, size, mult: brandMult * variantMult })))));
  const kept = combos
    .map((combo, order) => ({ combo, order, sortKey: random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, count)
    .sort((a, b) => a.order - b.order) // back to catalog order so ids read naturally
    .map(x => x.combo);

  const insertPlatform = db.prepare(`INSERT INTO platforms VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertProduct = db.prepare(`INSERT INTO products (name, brand, category, subcategory, variant, size_value, size_unit, mrp, keywords, search_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertListing = db.prepare(`INSERT INTO listings VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const now = new Date().toISOString();
  let listings = 0;

  db.exec('BEGIN');
  try {
    for (const p of PLATFORMS) {
      insertPlatform.run(p.id, p.name, p.type, p.eta, p.deliveryFee, p.freeDeliveryAbove, p.handlingFee, p.platformFee, p.smallCartFee, p.smallCartBelow);
    }

    for (const { spec, brand, variant, size, mult } of kept) {
      const name = [brand, variant, spec.name].filter(Boolean).join(' ');
      const mrp = roundMrp(spec.pricePerUnit * size * mult * Math.pow(size / spec.sizes[0], -0.12)); // bigger packs are cheaper per unit
      const keywords = `|${[spec.name, ...spec.keywords].map(k => k.toLowerCase()).join('|')}|`;
      const searchText = `${name} ${spec.category} ${spec.keywords.join(' ')}`.toLowerCase();
      const productId = Number(insertProduct.run(name, brand, spec.category, spec.name, variant, size, spec.unit, mrp, keywords, searchText).lastInsertRowid);

      // 2. A price on each store that carries it
      const baseRating = between(3.6, 4.7);
      const popularity = Math.exp(between(Math.log(50), Math.log(20000))); // review counts spread from tens to tens of thousands
      const isFresh = spec.category === 'Fruits & Vegetables';

      for (const p of PLATFORMS) {
        if (random() > (isFresh ? 0.95 : p.availability)) continue;
        const discount = clamp(p.avgDiscount + between(-0.06, 0.06) + (isFresh ? between(0, 0.1) : 0), 0, 0.35);
        const price = Math.min(mrp, Math.max(1, Math.round(mrp * (1 - discount)))); // never above MRP (Indian law)
        const rating = Math.round(clamp(baseRating + between(-0.15, 0.15), 1, 5) * 10) / 10;
        const reviews = Math.round(popularity * between(0.5, 1.5));
        insertListing.run(productId, p.id, price, mrp, random() < 0.94 ? 1 : 0, rating, reviews, now);
        listings++;
      }
    }

    const setMeta = db.prepare(`INSERT OR REPLACE INTO meta VALUES (?, ?)`);
    setMeta.run('data_source', 'synthetic');
    setMeta.run('generated_at', now);
    setMeta.run('seed', String(seed));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { products: kept.length, listings, combinationsAvailable: combos.length };
}

/** Indian MRPs: whole rupees, and multiples of 5 above ₹100. */
function roundMrp(value: number): number {
  return value < 100 ? Math.max(5, Math.round(value)) : Math.round(value / 5) * 5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Small seeded random generator, so the sample data is the same on every machine. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
