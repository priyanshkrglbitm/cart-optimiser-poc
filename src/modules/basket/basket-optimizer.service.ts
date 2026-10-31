import { Injectable } from '@nestjs/common';
import {
  PlatformSearchResult,
  PlatformBasketSummary,
  PlatformMetadata,
  SplitCartRecommendation,
  ProductItem,
  ParsedItemQuery
} from '../../common/types/commerce.types';
import { UniversalNormalizer } from '../../common/utils/normalizer';

interface Candidate {
  platform: PlatformMetadata;
  product: ProductItem; // carries multiplier + isSubstituted
  totalCost: number;    // price × packs needed
}

@Injectable()
export class BasketOptimizerService {
  /** One summary per store: the cheapest way to buy the whole list there, plus delivery fee. */
  calculatePlatformSummaries(
    queries: ParsedItemQuery[],
    allResults: PlatformSearchResult[]
  ): PlatformBasketSummary[] {
    const platforms = [...new Map(allResults.map(r => [r.platform.id, r.platform])).values()];

    const summaries = platforms.map(platform => {
      const perItem = queries.map(q => this.candidatesFor(q, allResults.filter(r => r.platform.id === platform.id)));
      const best = perItem.map(c => c[0] || null);
      const subtotal = best.reduce((sum, c) => sum + (c?.totalCost || 0), 0);
      const deliveryFee = this.deliveryFee(platform, subtotal);
      const foundCount = best.filter(Boolean).length;

      return {
        platform,
        foundItemsCount: foundCount,
        totalRequestedItems: queries.length,
        subtotalPrice: subtotal,
        deliveryFee,
        totalCost: subtotal + deliveryFee,
        isFullyAvailable: foundCount === queries.length,
        items: best.map(c => c?.product || null),
        alternatives: perItem.map(c => c.map(x => x.product)),
      };
    });

    // Stores that have everything come first, then cheapest
    return summaries.sort((a, b) =>
      Number(b.isFullyAvailable) - Number(a.isFullyAvailable) || a.totalCost - b.totalCost
    );
  }

  /**
   * Cheapest way to buy the list across stores, counting each store's delivery fee.
   * Tries every combination of stores (7 stores = 127 combos, instant) and keeps the cheapest.
   */
  calculateSplitCart(
    queries: ParsedItemQuery[],
    allResults: PlatformSearchResult[],
    bestSinglePlatformCost: number
  ): SplitCartRecommendation {
    const perItem = queries.map(q => this.candidatesFor(q, allResults));
    const buyable = queries.map((q, i) => ({ query: q, candidates: perItem[i] })).filter(x => x.candidates.length > 0);
    const platforms = [...new Map(buyable.flatMap(x => x.candidates.map(c => [c.platform.id, c.platform] as const))).values()];

    let best: { total: number; picks: Candidate[]; fees: { platform: string; fee: number }[] } | null = null;

    for (let mask = 1; mask < 1 << platforms.length; mask++) {
      const allowed = new Set(platforms.filter((_, i) => mask & (1 << i)).map(p => p.id));
      // shortcut: each item goes to its cheapest allowed store; ignores moving an item just to cross a
      // free-delivery threshold. Upgrade to an ILP solver if that case matters.
      const picks = buyable.map(x => x.candidates.find(c => allowed.has(c.platform.id)));
      if (picks.some(p => !p)) continue; // this combo can't buy everything
      const chosen = picks as Candidate[];

      const usedIds = new Set(chosen.map(c => c.platform.id));
      if (usedIds.size !== allowed.size) continue; // a store in the combo got nothing; a smaller combo covers it

      const fees = [...usedIds].map(id => {
        const platform = platforms.find(p => p.id === id)!;
        const subtotal = chosen.filter(c => c.platform.id === id).reduce((s, c) => s + c.totalCost, 0);
        return { platform: platform.name, fee: this.deliveryFee(platform, subtotal) };
      });
      const total = chosen.reduce((s, c) => s + c.totalCost, 0) + fees.reduce((s, f) => s + f.fee, 0);

      // Cheaper wins; on a tie, fewer orders wins
      if (!best || total < best.total || (total === best.total && fees.length < best.fees.length)) {
        best = { total, picks: chosen, fees };
      }
    }

    if (!best) {
      return { savingsVersusBestSinglePlatform: 0, optimizedTotalCost: 0, deliveryFees: [], assignments: [] };
    }

    return {
      savingsVersusBestSinglePlatform: Math.max(0, bestSinglePlatformCost - best.total),
      optimizedTotalCost: best.total,
      deliveryFees: best.fees,
      assignments: best.picks.map((c, i) => ({
        itemQuery: buyable[i].query.rawQuery,
        chosenPlatform: c.platform.name,
        product: c.product,
        itemPrice: c.totalCost,
      })),
    };
  }

  private deliveryFee(platform: PlatformMetadata, subtotal: number): number {
    return subtotal > 0 && subtotal < platform.freeDeliveryThreshold ? platform.baseDeliveryFee : 0;
  }

  /** All in-stock options for one list item across the given results, cheapest first. */
  private candidatesFor(query: ParsedItemQuery, results: PlatformSearchResult[]): Candidate[] {
    const candidates: Candidate[] = [];

    for (const res of results) {
      if (res.query !== query.rawQuery) continue;
      const products = res.matchedProducts.length > 0 ? res.matchedProducts : [res.matchedProduct];

      for (const p of products) {
        if (!p || !p.inStock) continue;
        const multiplier = this.packsNeeded(query, p);
        const brand = query.brand?.toLowerCase();
        const isSubstituted = !!brand && !p.brand.toLowerCase().includes(brand) && !p.rawTitle.toLowerCase().includes(brand);
        candidates.push({
          platform: res.platform,
          product: { ...p, multiplier, isSubstituted },
          totalCost: p.price * multiplier,
        });
      }
    }
    return candidates.sort((a, b) => a.totalCost - b.totalCost);
  }

  /** How many packs to buy to reach the asked size, e.g. 1kg asked, 500g pack → 2. */
  private packsNeeded(query: ParsedItemQuery, p: ProductItem): number {
    if (query.standardWeightGrams) {
      const packSize = p.weightGrams || p.volumeMl || UniversalNormalizer.extractWeightInGrams(p.rawTitle) || 0;
      if (packSize > 0) return Math.max(1, Math.ceil(query.standardWeightGrams / packSize));
    } else if (query.quantityUnit === 'pcs' && query.quantityValue) {
      const packPieces = UniversalNormalizer.extractPieceCount(p.rawTitle) || 1;
      return Math.max(1, Math.ceil(query.quantityValue / packPieces));
    }
    return 1;
  }
}
