import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BasketOptimizer } from './basketOptimizer';
import { ParsedItemQuery, PlatformMetadata, PlatformSearchResult, ProductItem } from '../types';

const store = (id: string, fee: number, threshold: number): PlatformMetadata =>
  ({ id, name: id, type: 'QUICK_COMMERCE', estimatedDelivery: '', baseDeliveryFee: fee, freeDeliveryThreshold: threshold });

const result = (platform: PlatformMetadata, query: string, price: number, inStock = true): PlatformSearchResult => {
  const p = { id: `${platform.id}_${query}`, platformId: platform.id, rawTitle: query, brand: 'X', price, inStock } as ProductItem;
  return { platform, query, matchedProduct: p, matchedProducts: [p], status: 'FOUND', latencyMs: 0 };
};

const q = (rawQuery: string): ParsedItemQuery => ({ rawQuery });

test('does not split when the extra delivery fee eats the saving', () => {
  const a = store('a', 30, 1000), b = store('b', 30, 1000);
  const results = [result(a, 'milk', 50), result(a, 'bread', 40), result(b, 'milk', 45), result(b, 'bread', 45)];
  const split = BasketOptimizer.calculateSplitCart([q('milk'), q('bread')], results, 120);
  // Splitting saves ₹5 on items but adds a ₹30 delivery fee, so one store (a: 90 + 30) wins
  assert.equal(split.optimizedTotalCost, 120);
  assert.equal(split.deliveryFees.length, 1);
  assert.equal(split.savingsVersusBestSinglePlatform, 0);
});

test('splits when it is cheaper after fees', () => {
  const a = store('a', 0, 0), b = store('b', 0, 0);
  const results = [result(a, 'milk', 50), result(a, 'bread', 40), result(b, 'milk', 30), result(b, 'bread', 60)];
  const split = BasketOptimizer.calculateSplitCart([q('milk'), q('bread')], results, 90);
  assert.equal(split.optimizedTotalCost, 70);
  assert.equal(split.savingsVersusBestSinglePlatform, 20);
  assert.deepEqual(split.assignments.map(x => x.chosenPlatform), ['b', 'a']);
});

test('skips out-of-stock items and stores with nothing', () => {
  const a = store('a', 0, 0);
  const summaries = BasketOptimizer.calculatePlatformSummaries([q('milk')], [result(a, 'milk', 50, false)]);
  assert.equal(summaries[0].foundItemsCount, 0);
  assert.equal(BasketOptimizer.calculateSplitCart([q('milk')], [result(a, 'milk', 50, false)], 0).assignments.length, 0);
});
