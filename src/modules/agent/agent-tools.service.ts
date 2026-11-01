import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { LocationContext, ProductItem, UniversalBasketResponse } from '../../common/types/commerce.types';
import { UniversalNormalizer } from '../../common/utils/normalizer';
import { BasketService } from '../basket/basket.service';
import { PriceFetcherService } from '../basket/price-fetcher.service';

export interface ProductSearch {
  query: string;
  products: {
    rank: number;
    product: string;
    cheapestPrice: number;
    cheapestAt: string;
    pricePerUnit: string;
    mrp: number;
    rating: number;
    reviews: number;
    storesWithStock: number;
  }[];
}

/** What a tool sends back: `data` goes to the model, `summary` to the logs; `search` and `basket` go to the dashboard. */
export interface ToolResult {
  data: unknown;
  summary: string;
  search?: ProductSearch;
  basket?: UniversalBasketResponse;
}

/** The tools the model may call. `ask_user` is handled by AgentService itself (it pauses the loop). */
export const AGENT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Find the top products for one item across all stores, ranked by value (price per unit), rating and reviews. Use for vague items ("atta", "snacks") or to compare options.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'One item, e.g. "atta", "amul butter", "chips"' },
          limit: { type: 'number', description: 'How many products to return, 1-10 (default 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'optimize_basket',
      description: 'Price the whole shopping list on every store, including all fees, and find the cheapest single store and the cheapest split. Use once the list is clear.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'The full shopping list, one entry per item with brand and size when known, e.g. ["aashirvaad atta 5kg", "amul butter 500g", "12 eggs"]',
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Ask the user a question and wait for their answer, e.g. to pick one of the options from search_products. Ends your turn.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' }, description: 'Up to 6 short answers the user can tap' },
        },
        required: ['question'],
      },
    },
  },
];

@Injectable()
export class AgentToolsService {
  constructor(
    private readonly priceFetcher: PriceFetcherService,
    private readonly basketService: BasketService,
  ) {}

  async run(name: string, args: any, location: LocationContext): Promise<ToolResult> {
    switch (name) {
      case 'search_products':
        return this.searchProducts(String(args.query ?? ''), Number(args.limit) || 10, location);
      case 'optimize_basket':
        return this.optimizeBasket(Array.isArray(args.items) ? args.items.map(String) : [], location);
      default:
        return { data: { error: `Unknown tool: ${name}` }, summary: `unknown tool ${name}` };
    }
  }

  /**
   * Top products for one item. The same product on several stores counts once, at its cheapest in-stock price.
   * Score: 45% value (price per 100 g/ml or per piece), 35% rating, 20% review count, plus a boost for the asked brand.
   */
  private async searchProducts(query: string, limit: number, location: LocationContext): Promise<ToolResult> {
    const parsed = UniversalNormalizer.parseQuery(query);
    const results = await this.priceFetcher.fetchPrices(parsed, location);

    // Group offers by product (fingerprint is the same product id on every store)
    const products = new Map<string, { item: ProductItem; offers: ProductItem[] }>();
    for (const offer of results.flatMap(r => r.matchedProducts).filter(p => p.inStock)) {
      const entry = products.get(offer.fingerprint) ?? { item: offer, offers: [] };
      entry.offers.push(offer);
      products.set(offer.fingerprint, entry);
    }

    const candidates = [...products.values()].map(({ offers }) => {
      const best = offers.reduce((a, b) => (b.price < a.price ? b : a));
      const rating = offers.reduce((sum, o) => sum + (o.rating ?? 0), 0) / offers.length;
      const reviews = Math.max(...offers.map(o => o.reviewCount ?? 0));
      return { best, offers, rating, reviews, unitPrice: best.unitPriceNormalized ?? best.price };
    });
    if (candidates.length === 0) {
      return { data: { query, products: [], note: 'No matching products. Try a simpler name.' }, summary: `0 products for "${query}"` };
    }

    const minUnit = Math.min(...candidates.map(c => c.unitPrice));
    const maxUnit = Math.max(...candidates.map(c => c.unitPrice));
    const brand = parsed.brand?.toLowerCase();
    const scored = candidates.map(c => {
      const value = maxUnit > minUnit ? 1 - (c.unitPrice - minUnit) / (maxUnit - minUnit) : 1;
      const rating = Math.min(1, Math.max(0, (c.rating - 3) / 2));
      const reviews = Math.min(1, Math.log10(c.reviews + 1) / 5);
      const brandBoost = brand && c.best.brand.toLowerCase().includes(brand) ? 0.3 : 0;
      return { ...c, score: 0.45 * value + 0.35 * rating + 0.2 * reviews + brandBoost };
    }).sort((a, b) => b.score - a.score).slice(0, Math.min(Math.max(limit, 1), 10));

    const unit = (p: ProductItem) => (p.weightGrams ? '100g' : p.volumeMl ? '100ml' : 'piece');
    const top: ProductSearch['products'] = scored.map((c, i) => ({
      rank: i + 1,
      product: c.best.rawTitle,
      cheapestPrice: c.best.price,
      cheapestAt: c.best.platformName,
      pricePerUnit: `₹${Math.round(c.unitPrice * 10) / 10}/${unit(c.best)}`,
      mrp: c.best.mrp,
      rating: Math.round(c.rating * 10) / 10,
      reviews: c.reviews,
      storesWithStock: c.offers.length,
    }));

    const search = { query, products: top };
    // The model only needs the top 5 to recommend; fewer tokens keeps the free tier from throttling
    const forModel = top.slice(0, 5).map(p => ({ rank: p.rank, product: p.product, price: p.cheapestPrice, at: p.cheapestAt, perUnit: p.pricePerUnit, rating: p.rating }));
    return { data: { query, products: forModel, moreShownToUser: top.length - forModel.length }, search, summary: `${top.length} products for "${query}", best: ${top[0].product}` };
  }

  /** The full optimizer (same as the dashboard's Compare prices), returned in a compact form for the model. */
  private async optimizeBasket(items: string[], location: LocationContext): Promise<ToolResult> {
    if (items.length === 0) return { data: { error: 'items is empty' }, summary: 'no items' };

    const basket = await this.basketService.optimizeBasket(items.slice(0, 30), location, { withSummary: false });
    const best = basket.overallBestSinglePlatform;
    const split = basket.splitCartRecommendation;

    const data = {
      items: basket.queryItems.map(q => q.rawQuery),
      bestSingleStore: best && {
        store: best.platform.name,
        total: best.totalCost,
        itemsCost: best.subtotalPrice,
        fees: best.fees.total,
        hasAllItems: best.isFullyAvailable,
        picks: best.items.map((it, i) => (it ? `${it.multiplier && it.multiplier > 1 ? `${it.multiplier}x ` : ''}${it.rawTitle} ₹${it.price * (it.multiplier || 1)}` : `${items[i]}: not available`)),
      },
      allStores: basket.platformSummaries.map(s => ({ store: s.platform.name, total: s.totalCost, itemsFound: `${s.foundItemsCount}/${s.totalRequestedItems}` })),
      cheapestSplit: {
        total: split.optimizedTotalCost,
        savingVsBestStore: split.savingsVersusBestSinglePlatform,
        orders: split.fees.length,
        plan: split.assignments.map(a => `${a.itemQuery} → ${a.chosenPlatform}: ${a.product.rawTitle} ₹${a.itemPrice}`),
      },
    };

    return {
      data,
      basket,
      summary: best ? `best ${best.platform.name} ₹${best.totalCost}, split ₹${split.optimizedTotalCost}` : 'no store has these items',
    };
  }
}
