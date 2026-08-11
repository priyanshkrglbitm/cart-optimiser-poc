import { 
  LocationContext,
  ParsedItemQuery, 
  PlatformSearchResult, 
  UniversalBasketResponse 
} from '../types/commerce';
import { UniversalNormalizer } from '../services/universalNormalizer';
import { PriceFetcherAgent } from './priceFetcherAgent';
import { CartOptimizerAgent } from './cartOptimizerAgent';

export class SupervisorAgent {
  private priceFetcher: PriceFetcherAgent;

  constructor() {
    this.priceFetcher = new PriceFetcherAgent();
  }

  public async optimizeBasket(
    rawItemQueries: string[], 
    location?: LocationContext
  ): Promise<UniversalBasketResponse> {
    const logs: string[] = [];
    
    if (location) {
      logs.push(`[SupervisorAgent] Location Set -> Lat: ${location.latitude}, Lng: ${location.longitude} (${location.address || location.city || 'Nearby DarkStore'})`);
    } else {
      logs.push(`[SupervisorAgent] Defaulting to Default Location Context (Bangalore / Mumbai Region).`);
    }
    logs.push(`[SupervisorAgent] Received basket with ${rawItemQueries.length} query items.`);

    const parsedQueries: ParsedItemQuery[] = rawItemQueries.map(q => {
      const parsed = UniversalNormalizer.parseQuery(q);
      parsed.location = location;
      logs.push(`[SupervisorAgent] Parsed "${q}" -> Brand: ${parsed.brand || 'Any'}, Weight: ${parsed.standardWeightGrams || 'Std'}g`);
      return parsed;
    });

    logs.push(`[SupervisorAgent] Dispatching multi-variant price fetch tasks across quick-commerce & e-commerce platforms...`);
    
    const fetchPromises = parsedQueries.map(query => this.priceFetcher.fetchPrices(query, location));
    const nestedResults = await Promise.all(fetchPromises);
    const allResults: PlatformSearchResult[] = nestedResults.flat();

    logs.push(`[SupervisorAgent] Collected ${allResults.length} platform search responses with multi-variant stock details.`);

    const summaries = CartOptimizerAgent.calculatePlatformSummaries(parsedQueries, allResults);

    const quickCommerceSummaries = summaries.filter(s => s.platform.type === 'QUICK_COMMERCE');
    const standardECommerceSummaries = summaries.filter(s => s.platform.type === 'STANDARD_ECOMMERCE');

    const quickBest = quickCommerceSummaries.length > 0 ? quickCommerceSummaries[0] : null;
    const ecommerceBest = standardECommerceSummaries.length > 0 ? standardECommerceSummaries[0] : null;
    const overallBest = summaries.length > 0 ? summaries[0] : null;

    const bestCost = overallBest ? overallBest.totalCost : 0;
    const splitCart = CartOptimizerAgent.calculateSplitCart(parsedQueries, allResults, bestCost);

    logs.push(`[SupervisorAgent] Optimization Complete! Best Single Store: ${overallBest?.platform.name || 'N/A'} (₹${overallBest?.totalCost || 0}).`);
    if (splitCart.savingsVersusBestSinglePlatform > 0) {
      logs.push(`[SupervisorAgent] 💡 Split Cart Strategy saves an extra ₹${splitCart.savingsVersusBestSinglePlatform}!`);
    }

    return {
      location,
      queryItems: parsedQueries,
      quickCommerceTotalBest: quickBest,
      standardECommerceTotalBest: ecommerceBest,
      overallBestSinglePlatform: overallBest,
      splitCartRecommendation: splitCart,
      platformSummaries: summaries,
      agentLogs: logs
    };
  }
}

