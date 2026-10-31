import { ICommerceAgent, LocationContext, ParsedItemQuery, PlatformMetadata, PlatformSearchResult, ProductItem } from '../types/commerce';
import { UniversalNormalizer } from '../services/universalNormalizer';

import { BlinkitScraper } from '../services/scrapers/blinkitScraper';

export class BlinkitAgent implements ICommerceAgent {
  private scraper = new BlinkitScraper();
  
  public metadata: PlatformMetadata = {
    id: 'blinkit',
    name: 'Blinkit',
    type: 'QUICK_COMMERCE',
    estimatedDelivery: '10-15 mins',
    baseDeliveryFee: 25,
    freeDeliveryThreshold: 299
  };

  public async searchProduct(query: ParsedItemQuery, location?: LocationContext): Promise<PlatformSearchResult> {
    const startTime = Date.now();
    const queryStr = query.rawQuery.toLowerCase();

    // Call real scraper
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

import { ZeptoScraper } from '../services/scrapers/zeptoScraper';
import { InstamartScraper } from '../services/scrapers/instamartScraper';

export class ZeptoAgent implements ICommerceAgent {
  private scraper = new ZeptoScraper();

  public metadata: PlatformMetadata = {
    id: 'zepto',
    name: 'Zepto',
    type: 'QUICK_COMMERCE',
    estimatedDelivery: '10 mins',
    baseDeliveryFee: 15,
    freeDeliveryThreshold: 199
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

export class InstamartAgent implements ICommerceAgent {
  private scraper = new InstamartScraper();

  public metadata: PlatformMetadata = {
    id: 'instamart',
    name: 'Swiggy Instamart',
    type: 'QUICK_COMMERCE',
    estimatedDelivery: '15-20 mins',
    baseDeliveryFee: 30,
    freeDeliveryThreshold: 299
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

import { BigBasketScraper } from '../services/scrapers/bigBasketScraper';

export class BigBasketAgent implements ICommerceAgent {
  public metadata: PlatformMetadata = {
    id: 'bigbasket',
    name: 'BigBasket',
    type: 'QUICK_COMMERCE',
    estimatedDelivery: '15-25 mins',
    baseDeliveryFee: 25,
    freeDeliveryThreshold: 499
  };

  private scraper = new BigBasketScraper();

  public async searchProduct(query: ParsedItemQuery, location?: LocationContext): Promise<PlatformSearchResult> {
    const startTime = Date.now();

    try {
      const liveItems = await this.scraper.search(query, location);
      const topMatch = liveItems.length > 0 ? liveItems[0] : null;

      return {
        platform: this.metadata,
        query: query.rawQuery,
        matchedProduct: topMatch,
        matchedProducts: liveItems,
        status: topMatch ? 'FOUND' : 'NOT_FOUND',
        latencyMs: Date.now() - startTime
      };
    } catch (err: any) {
      console.warn(`[BigBasketAgent] Scraper failed: ${err.message}`);
      return {
        platform: this.metadata,
        query: query.rawQuery,
        matchedProduct: null,
        matchedProducts: [],
        status: 'ERROR',
        latencyMs: Date.now() - startTime
      };
    }
  }
}
