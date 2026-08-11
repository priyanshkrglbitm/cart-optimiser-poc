import { 
  ICommerceAgent, 
  LocationContext, 
  ParsedItemQuery, 
  PlatformSearchResult, 
  ProductItem 
} from '../types/commerce';
import { 
  BlinkitAgent, 
  ZeptoAgent, 
  InstamartAgent, 
  BigBasketAgent 
} from './quickCommerceAgents';
import { 
  AmazonAgent, 
  FlipkartAgent, 
  JioMartAgent 
} from './eCommerceAgents';
import { UniversalNormalizer } from '../services/universalNormalizer';

export class PriceFetcherAgent {
  private registeredAgents: ICommerceAgent[] = [
    new BlinkitAgent(),
    new ZeptoAgent(),
    new InstamartAgent(),
    new BigBasketAgent(),
    new AmazonAgent(),
    new FlipkartAgent(),
    new JioMartAgent()
  ];

  public async fetchPrices( query: ParsedItemQuery, location?: LocationContext): Promise<PlatformSearchResult[]> {
    // Parse user query semantically using Llama-3 deconstruction
    const parsedQuery = await UniversalNormalizer.deconstructQueryWithLLM(query.rawQuery);
    console.log(`[PriceFetcherAgent] 🧠 Semantically Deconstructed: Brand="${parsedQuery.brand || 'None'}", Category="${parsedQuery.category || 'None'}", Weight="${parsedQuery.standardWeightGrams || 'None'}g"`);

    const searchPromises = this.registeredAgents.map(async (agent) => {
      const startTime = Date.now();
      
      // Broaden search query: search by generic category + weight if available, to find alternative brands
      let genericSearchQuery = query.rawQuery;
      if (parsedQuery.category) {
        genericSearchQuery = parsedQuery.category;
        if (parsedQuery.standardWeightGrams) {
          const qty = parsedQuery.standardWeightGrams >= 1000 
            ? `${parsedQuery.standardWeightGrams / 1000} kg` 
            : `${parsedQuery.standardWeightGrams} g`;
          genericSearchQuery += ` ${qty}`;
        }
      }

      const agentQuery: ParsedItemQuery = {
        ...parsedQuery,
        rawQuery: genericSearchQuery
      };

      // Pass generic query & location context to platform agent
      const rawResult = await agent.searchProduct(agentQuery, location);
      
      // Expand matching variants for broad categories (e.g. Milk, Oil, Butter, Dal, Rice, Eggs)
      const multiVariants: ProductItem[] = [];

      const allMatched = rawResult.matchedProduct 
        ? [rawResult.matchedProduct, ...multiVariants]
        : multiVariants;

      if (rawResult.matchedProducts && rawResult.matchedProducts.length > 0) {
        allMatched.push(...rawResult.matchedProducts);
      }

      // Remove duplicates by id
      const uniqueProducts = Array.from(new Map(allMatched.map(p => [p.id, p])).values());

      // Prioritize the requested brand if specified
      let sortedProducts = [...uniqueProducts];
      if (parsedQuery.brand) {
        const targetBrand = parsedQuery.brand.toLowerCase();
        sortedProducts.sort((a, b) => {
          const aMatches = a.brand.toLowerCase().includes(targetBrand) || a.rawTitle.toLowerCase().includes(targetBrand);
          const bMatches = b.brand.toLowerCase().includes(targetBrand) || b.rawTitle.toLowerCase().includes(targetBrand);
          if (aMatches && !bMatches) return -1;
          if (!aMatches && bMatches) return 1;
          return a.price - b.price; // fallback to lowest price
        });
      } else {
        sortedProducts.sort((a, b) => a.price - b.price);
      }

      const status: PlatformSearchResult['status'] = sortedProducts.length > 0 
        ? (sortedProducts.some(p => p.inStock) ? 'FOUND' : 'OUT_OF_STOCK')
        : 'NOT_FOUND';

      return {
        platform: agent.metadata,
        query: query.rawQuery, // Return the original raw query for optimizer lookup mapping
        matchedProduct: sortedProducts[0] || null,
        matchedProducts: sortedProducts,
        status,
        latencyMs: Date.now() - startTime
      };
    });

    return Promise.all(searchPromises);
  }
}
