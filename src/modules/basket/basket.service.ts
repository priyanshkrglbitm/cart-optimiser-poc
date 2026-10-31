import { Injectable, Logger } from '@nestjs/common';
import { LocationContext, PlatformSearchResult, UniversalBasketResponse } from '../../common/types/commerce.types';
import { LlmService } from '../llm/llm.service';
import { QueryParserService } from './query-parser.service';
import { PriceFetcherService } from './price-fetcher.service';
import { BasketOptimizerService } from './basket-optimizer.service';

const CACHE_TTL_MS = 90 * 1000;

/** The whole pipeline: parse list → fetch prices from every store → pick best store and best split. */
@Injectable()
export class BasketService {
  private readonly logger = new Logger(BasketService.name);
  private readonly summaryCache = new Map<string, string>();
  // Same basket + location within 90s returns the saved result; identical requests in flight share one job.
  private readonly recentResults = new Map<string, { timestamp: number; data: UniversalBasketResponse }>();
  private readonly inFlight = new Map<string, Promise<UniversalBasketResponse>>();

  constructor(
    private readonly queryParser: QueryParserService,
    private readonly priceFetcher: PriceFetcherService,
    private readonly optimizer: BasketOptimizerService,
    private readonly llm: LlmService,
  ) {}

  /** Used by the API: same as optimizeBasket, with a short cache and request de-duplication. */
  async optimizeBasketCached(rawItems: string[], location?: LocationContext): Promise<UniversalBasketResponse> {
    const cacheKey = `${rawItems.map(i => i.toLowerCase().trim()).sort().join('|')}@${(location?.latitude ?? 0).toFixed(3)},${(location?.longitude ?? 0).toFixed(3)}`;

    const cached = this.recentResults.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;

    const running = this.inFlight.get(cacheKey);
    if (running) return running;

    const job = this.optimizeBasket(rawItems, location);
    this.inFlight.set(cacheKey, job);
    try {
      const data = await job;
      this.recentResults.set(cacheKey, { timestamp: Date.now(), data });
      return data;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  async optimizeBasket(rawItems: string[], location?: LocationContext): Promise<UniversalBasketResponse> {
    const logs: string[] = [];
    logs.push(location
      ? `[Basket] Location: ${location.latitude}, ${location.longitude} (${location.address || location.city || 'nearby dark store'})`
      : `[Basket] No location given, using each store's default.`);

    // 1. Parse
    const queries = await this.queryParser.parseBasket(rawItems);
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
    const summaries = this.optimizer.calculatePlatformSummaries(queries, results);
    const overallBest = summaries[0] || null;
    const splitCart = this.optimizer.calculateSplitCart(queries, results, overallBest?.totalCost || 0);

    logs.push(`[Basket] Best single store: ${overallBest?.platform.name || 'N/A'} (₹${overallBest?.totalCost || 0}).`);
    if (splitCart.savingsVersusBestSinglePlatform > 0) {
      logs.push(`[Basket] Splitting the order saves ₹${splitCart.savingsVersusBestSinglePlatform}.`);
    }
    this.logger.log(`${rawItems.length} items → best ${overallBest?.platform.name || 'N/A'} ₹${overallBest?.totalCost || 0}`);

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

    const summary = await this.llm.askText(
      `You are a shopping assistant. Summarize this grocery basket result for the user in 2 short sentences.\n` +
      `Basket: ${JSON.stringify(rawItems)}\n` +
      `Best single store: ${best.platform.name} (total ₹${best.totalCost})\n` +
      `Extra saving by splitting across stores: ₹${r.splitCartRecommendation.savingsVersusBestSinglePlatform}`
    );
    if (summary) this.summaryCache.set(cacheKey, summary);
    return summary;
  }
}
