import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GROQ_API_KEY = ''; // force the rules-only path; no network in tests
import { parseBasket } from './queryParser';

test('parses brand and size with rules when the LLM is off', async () => {
  const [butter, milk] = await parseBasket(['Amul Butter 500g', 'milk 1L']);
  assert.equal(butter.brand, 'Amul');
  assert.equal(butter.standardWeightGrams, 500);
  assert.equal(milk.brand, undefined);
  assert.equal(milk.standardWeightGrams, 1000);
});

test('strips full unit words from the item name', async () => {
  const [milk, gold] = await parseBasket(['doodh 1 litre', 'gold milk 2 pcs']);
  assert.equal(milk.category, 'doodh');
  assert.equal(milk.standardWeightGrams, 1000);
  assert.equal(gold.standardWeightGrams, undefined); // "2 pcs" is a count, and "gold" is not grams
});
