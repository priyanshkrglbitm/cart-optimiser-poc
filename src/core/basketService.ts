import { LocationContext, PlatformSearchResult, UniversalBasketResponse } from '../types';
import { parseBasket } from './queryParser';
import { PriceFetcher } from './priceFetcher';
import { BasketOptimizer } from './basketOptimizer';
import { askText } from '../llm/llmClient';

/** The whole pipeline: parse list → fetch prices from every store → pick best store and best split. */
export class BasketService {
  private priceFetcher = new PriceFetcher();
  private summaryCache = new Map<string, string>();

  public async optimizeBasket(rawItems: string[], location?: LocationContext): Promise<UniversalBasketResponse> {
    const logs: string[] = [];
    logs.push(location
      ? `[Basket] Location: ${location.latitude}, ${location.longitude} (${location.address || location.city || 'nearby dark store'})`
      : `[Basket] No location given, using each store's default.`);

    // 1. Parse
    const queries = await parseBasket(rawItems);
    for (const q of queries) {
      q.location = location;
      logs.push(`[Basket] Parsed "${q.rawQuery}" -> Brand: ${q.brand || 'Any'}, Item: ${q.category || '?'}, Size: ${q.standardWeightGrams || 'Std'}g`);
    }

    // 2. Fetch
    const results: PlatformSearchResult[] = (await Promise.all(
      queries.map(q => this.priceFetcher.fetchPrices(q, location))
    )).flat();
    logs.push(`[Basket] Collected ${results.length} store results.`);

    // 3. Optimize
    const summaries = BasketOptimizer.calculatePlatformSummaries(queries, results);
    const overallBest = summaries[0] || null;
    const splitCart = BasketOptimizer.calculateSplitCart(queries, results, overallBest?.totalCost || 0);

    logs.push(`[Basket] Best single store: ${overallBest?.platform.name || 'N/A'} (₹${overallBest?.totalCost || 0}).`);
    if (splitCart.savingsVersusBestSinglePlatform > 0) {
      logs.push(`[Basket] Splitting the order saves ₹${splitCart.savingsVersusBestSinglePlatform}.`);
    }

    const response: UniversalBasketResponse = {
      location,
      queryItems: queries,
      quickCommerceTotalBest: summaries.find(s => s.platform.type === 'QUICK_COMMERCE') || null,
      standardECommerceTotalBest: summaries.find(s => s.platform.type === 'STANDARD_ECOMMERCE') || null,
      overallBestSinglePlatform: overallBest,
      splitCartRecommendation: splitCart,
      platformSummaries: summaries,
      agentLogs: logs,
    };

    // 4. Optional 2-line AI summary (skipped when nothing was found)
    if (overallBest && overallBest.totalCost > 0) {
      const summary = await this.summarize(rawItems, response);
      if (summary) logs.push(`[AI Insights]: ${summary}`);
    }
    return response;
  }

  private async summarize(rawItems: string[], r: UniversalBasketResponse): Promise<string | null> {
    const best = r.overallBestSinglePlatform!;
    const cacheKey = JSON.stringify({ rawItems, store: best.platform.name, total: best.totalCost });
    if (this.summaryCache.has(cacheKey)) return this.summaryCache.get(cacheKey)!;

    const summary = await askText(
      `You are a shopping assistant. Summarize this grocery basket result for the user in 2 short sentences.\n` +
      `Basket: ${JSON.stringify(rawItems)}\n` +
      `Best single store: ${best.platform.name} (total ₹${best.totalCost})\n` +
      `Extra saving by splitting across stores: ₹${r.splitCartRecommendation.savingsVersusBestSinglePlatform}`
    );
    if (summary) this.summaryCache.set(cacheKey, summary);
    return summary;
  }
}
