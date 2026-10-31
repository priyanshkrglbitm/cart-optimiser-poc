import { Injectable } from '@nestjs/common';
import { ParsedItemQuery } from '../../common/types/commerce.types';
import { UniversalNormalizer } from '../../common/utils/normalizer';
import { LlmService } from '../llm/llm.service';

interface LlmItem {
  brand: string | null;
  genericCategory: string | null;
  weightGrams: number | null;
}

/**
 * Turns the user's raw list ("amul butter 500g", "doodh 1L") into structured queries.
 * Rules always run; the LLM (one call for the whole list) only improves brand/category/weight.
 */
@Injectable()
export class QueryParserService {
  // Same item text always parses the same way, so each one costs at most one LLM call per server run.
  private readonly llmCache = new Map<string, LlmItem>();

  constructor(private readonly llm: LlmService) {}

  async parseBasket(rawItems: string[]): Promise<ParsedItemQuery[]> {
    const uncached = [...new Set(rawItems.map(key))].filter(k => !this.llmCache.has(k));

    if (uncached.length > 0) {
      const reply = await this.llm.askJson<{ items: LlmItem[] }>(buildPrompt(uncached));
      if (reply?.items?.length === uncached.length) {
        uncached.forEach((k, i) => this.llmCache.set(k, reply.items[i]));
      }
    }

    return rawItems.map(raw => mergeWithRules(raw, this.llmCache.get(key(raw))));
  }
}

const key = (raw: string) => raw.toLowerCase().trim();

function buildPrompt(items: string[]): string {
  return `You parse Indian grocery shopping list items. Items may be Hinglish (doodh = milk, atta = wheat flour, dahi = curd).
For each item give:
- brand: brand name, or null if none is mentioned
- genericCategory: the product in English without brand or size (e.g. "Toned Milk", "Toor Dal", "Butter")
- weightGrams: total grams (or ml for liquids) asked for, or null if no size is given

Items: ${JSON.stringify(items)}

Reply with JSON only: {"items": [{"brand": ..., "genericCategory": ..., "weightGrams": ...}]} with exactly ${items.length} entries, in the same order.`;
}

function mergeWithRules(raw: string, llm?: LlmItem): ParsedItemQuery {
  const rules = UniversalNormalizer.parseQuery(raw);
  if (!llm) return rules;

  const weight = llm.weightGrams || rules.standardWeightGrams;
  return {
    rawQuery: raw,
    brand: llm.brand || rules.brand,
    category: llm.genericCategory || rules.category,
    standardWeightGrams: weight,
    quantityValue: llm.weightGrams ? (weight! >= 1000 ? weight! / 1000 : weight) : rules.quantityValue,
    quantityUnit: llm.weightGrams ? (weight! >= 1000 ? 'kg' : 'g') : rules.quantityUnit,
  };
}
