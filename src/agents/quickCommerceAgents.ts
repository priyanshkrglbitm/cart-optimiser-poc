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

export class BigBasketAgent implements ICommerceAgent {
  public metadata: PlatformMetadata = {
    id: 'bigbasket',
    name: 'BigBasket',
    type: 'QUICK_COMMERCE',
    estimatedDelivery: '20-30 mins',
    baseDeliveryFee: 20,
    freeDeliveryThreshold: 499
  };

  public async searchProduct(query: ParsedItemQuery): Promise<PlatformSearchResult> {
    const startTime = Date.now();
    const queryStr = query.rawQuery.toLowerCase();

    let item: ProductItem | null = null;

    if (queryStr.includes('toor dal') || queryStr.includes('arhar dal')) {
      item = {
        id: 'bb_401',
        platformId: this.metadata.id,
        platformName: this.metadata.name,
        platformType: this.metadata.type,
        rawTitle: 'Tata Sampann Toor Dal/Arhar Dal - Unpolished, 1 kg',
        brand: 'Tata Sampann',
        variant: 'Toor Dal',
        weightGrams: 1000,
        price: 209,
        mrp: 245,
        discountPercentage: 15,
        inStock: true,
        productUrl: 'https://bigbasket.com/pd/401',
        fingerprint: UniversalNormalizer.generateFingerprint('Tata Sampann', 'Toor Dal', 1000),
        confidenceScore: 0.99
      };
    } else if (queryStr.includes('butter')) {
      item = {
        id: 'bb_402',
        platformId: this.metadata.id,
        platformName: this.metadata.name,
        platformType: this.metadata.type,
        rawTitle: 'Amul Butter - Pasteurised, 500 g Carton',
        brand: 'Amul',
        variant: 'Butter',
        weightGrams: 500,
        price: 275,
        mrp: 280,
        discountPercentage: 2,
        inStock: true,
        productUrl: 'https://bigbasket.com/pd/402',
        fingerprint: UniversalNormalizer.generateFingerprint('Amul', 'Butter', 500),
        confidenceScore: 0.99
      };
    } else if (queryStr.includes('sunflower oil') || queryStr.includes('oil')) {
      item = {
        id: 'bb_403',
        platformId: this.metadata.id,
        platformName: this.metadata.name,
        platformType: this.metadata.type,
        rawTitle: 'Fortune Sunlite Refined Sunflower Oil, 1 L Pouch',
        brand: 'Fortune',
        variant: 'Sunflower Oil',
        weightGrams: 1000,
        price: 135,
        mrp: 165,
        discountPercentage: 18,
        inStock: true,
        productUrl: 'https://bigbasket.com/pd/403',
        fingerprint: UniversalNormalizer.generateFingerprint('Fortune', 'Sunflower Oil', 1000),
        confidenceScore: 0.99
      };
    }

    return {
      platform: this.metadata,
      query: query.rawQuery,
      matchedProduct: item,
      matchedProducts: item ? [item] : [],
      status: item ? 'FOUND' : 'NOT_FOUND',
      latencyMs: Date.now() - startTime
    };
  }
}
