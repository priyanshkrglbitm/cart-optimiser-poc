import { ICommerceAgent, ParsedItemQuery, PlatformMetadata, PlatformSearchResult, ProductItem } from '../types/commerce';
import { UniversalNormalizer } from '../services/universalNormalizer';
import { AmazonFreshScraper } from '../services/scrapers/amazonFreshScraper';
import { FlipkartMinutesScraper } from '../services/scrapers/flipkartMinutesScraper';

export class AmazonAgent implements ICommerceAgent {
  private scraper = new AmazonFreshScraper();

  public metadata: PlatformMetadata = {
    id: 'amazon',
    name: 'Amazon Fresh',
    type: 'QUICK_COMMERCE',
    estimatedDelivery: 'Same Day / 2h',
    baseDeliveryFee: 49,
    freeDeliveryThreshold: 499
  };

  public async searchProduct(query: ParsedItemQuery, location?: LocationContext): Promise<PlatformSearchResult> {
    const startTime = Date.now();
    const items = await this.scraper.search(query, location);
    const item = items.length > 0 ? items[0] : null;

    return {
      platform: this.metadata,
      query: query.rawQuery,
      matchedProduct: item,
      matchedProducts: items,
      status: items.length > 0 ? 'FOUND' : 'NOT_FOUND',
      latencyMs: Date.now() - startTime
    };
  }
}

export class FlipkartAgent implements ICommerceAgent {
  private scraper = new FlipkartMinutesScraper();

  public metadata: PlatformMetadata = {
    id: 'flipkart',
    name: 'Flipkart Minutes',
    type: 'QUICK_COMMERCE',
    estimatedDelivery: '10-15 mins',
    baseDeliveryFee: 15,
    freeDeliveryThreshold: 199
  };

  public async searchProduct(query: ParsedItemQuery, location?: LocationContext): Promise<PlatformSearchResult> {
    const startTime = Date.now();
    const items = await this.scraper.search(query, location);
    const item = items.length > 0 ? items[0] : null;

    return {
      platform: this.metadata,
      query: query.rawQuery,
      matchedProduct: item,
      matchedProducts: items,
      status: items.length > 0 ? 'FOUND' : 'NOT_FOUND',
      latencyMs: Date.now() - startTime
    };
  }
}

import { JioMartScraper } from '../services/scrapers/jioMartScraper';
import { LocationContext } from '../types/commerce';

export class JioMartAgent implements ICommerceAgent {
  private scraper = new JioMartScraper();

  public metadata: PlatformMetadata = {
    id: 'jiomart',
    name: 'JioMart',
    type: 'STANDARD_ECOMMERCE',
    estimatedDelivery: 'Same Day / 24h',
    baseDeliveryFee: 0,
    freeDeliveryThreshold: 0
  };

  public async searchProduct(query: ParsedItemQuery, location?: LocationContext): Promise<PlatformSearchResult> {
    const startTime = Date.now();
    const queryStr = query.rawQuery.toLowerCase();

    const items = await this.scraper.search(query, location);
    const item = items.length > 0 ? items[0] : null;

    return {
      platform: this.metadata,
      query: query.rawQuery,
      matchedProduct: item,
      matchedProducts: items,
      status: items.length > 0 ? 'FOUND' : 'NOT_FOUND',
      latencyMs: Date.now() - startTime
    };
  }
}
