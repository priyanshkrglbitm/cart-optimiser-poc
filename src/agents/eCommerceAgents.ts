import { ICommerceAgent, ParsedItemQuery, PlatformMetadata, PlatformSearchResult, ProductItem } from '../types/commerce';
import { UniversalNormalizer } from '../services/universalNormalizer';

export class AmazonAgent implements ICommerceAgent {
  public metadata: PlatformMetadata = {
    id: 'amazon',
    name: 'Amazon India',
    type: 'STANDARD_ECOMMERCE',
    estimatedDelivery: '1-2 Days (Prime)',
    baseDeliveryFee: 40,
    freeDeliveryThreshold: 499
  };

  public async searchProduct(query: ParsedItemQuery): Promise<PlatformSearchResult> {
    const startTime = Date.now();
    const queryStr = query.rawQuery.toLowerCase();

    let item: ProductItem | null = null;

    if (queryStr.includes('toor dal') || queryStr.includes('arhar dal')) {
      item = {
        id: 'amz_501',
        platformId: this.metadata.id,
        platformName: this.metadata.name,
        platformType: this.metadata.type,
        rawTitle: 'Tata Sampann Unpolished Toor Dal / Arhar Dal, 1kg',
        brand: 'Tata Sampann',
        variant: 'Toor Dal',
        weightGrams: 1000,
        price: 205,
        mrp: 245,
        discountPercentage: 16,
        inStock: true,
        productUrl: 'https://amazon.in/dp/B001501',
        fingerprint: UniversalNormalizer.generateFingerprint('Tata Sampann', 'Toor Dal', 1000),
        confidenceScore: 0.99
      };
    } else if (queryStr.includes('butter')) {
      item = {
        id: 'amz_502',
        platformId: this.metadata.id,
        platformName: this.metadata.name,
        platformType: this.metadata.type,
        rawTitle: 'Amul Butter 500g Fresh Pack',
        brand: 'Amul',
        variant: 'Butter',
        weightGrams: 500,
        price: 275,
        mrp: 280,
        discountPercentage: 2,
        inStock: true,
        productUrl: 'https://amazon.in/dp/B001502',
        fingerprint: UniversalNormalizer.generateFingerprint('Amul', 'Butter', 500),
        confidenceScore: 0.98
      };
    } else if (queryStr.includes('sunflower oil') || queryStr.includes('oil')) {
      item = {
        id: 'amz_503',
        platformId: this.metadata.id,
        platformName: this.metadata.name,
        platformType: this.metadata.type,
        rawTitle: 'Fortune Sunlite Refined Sunflower Oil, 1L Pouch',
        brand: 'Fortune',
        variant: 'Sunflower Oil',
        weightGrams: 1000,
        price: 130,
        mrp: 165,
        discountPercentage: 21,
        inStock: true,
        productUrl: 'https://amazon.in/dp/B001503',
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

export class FlipkartAgent implements ICommerceAgent {
  public metadata: PlatformMetadata = {
    id: 'flipkart',
    name: 'Flipkart Minutes',
    type: 'QUICK_COMMERCE',
    estimatedDelivery: '10-15 mins',
    baseDeliveryFee: 15,
    freeDeliveryThreshold: 199
  };

  public async searchProduct(query: ParsedItemQuery): Promise<PlatformSearchResult> {
    const startTime = Date.now();
    const queryStr = query.rawQuery.toLowerCase();

    let item: ProductItem | null = null;

    if (queryStr.includes('toor dal') || queryStr.includes('arhar dal')) {
      item = {
        id: 'fk_601',
        platformId: this.metadata.id,
        platformName: this.metadata.name,
        platformType: this.metadata.type,
        rawTitle: 'Tata Sampann Unpolished Arhar Dal (Toor Dal) (1 kg)',
        brand: 'Tata Sampann',
        variant: 'Toor Dal',
        weightGrams: 1000,
        price: 208,
        mrp: 245,
        discountPercentage: 15,
        inStock: true,
        productUrl: 'https://flipkart.com/tata-sampann-toor-dal/p/itm601',
        fingerprint: UniversalNormalizer.generateFingerprint('Tata Sampann', 'Toor Dal', 1000),
        confidenceScore: 0.98
      };
    } else if (queryStr.includes('butter')) {
      item = {
        id: 'fk_602',
        platformId: this.metadata.id,
        platformName: this.metadata.name,
        platformType: this.metadata.type,
        rawTitle: 'Amul Pasteurised Salted Butter (500 g)',
        brand: 'Amul',
        variant: 'Butter',
        weightGrams: 500,
        price: 275,
        mrp: 280,
        discountPercentage: 2,
        inStock: true,
        productUrl: 'https://flipkart.com/amul-butter/p/itm602',
        fingerprint: UniversalNormalizer.generateFingerprint('Amul', 'Butter', 500),
        confidenceScore: 0.99
      };
    } else if (queryStr.includes('sunflower oil') || queryStr.includes('oil')) {
      item = {
        id: 'fk_603',
        platformId: this.metadata.id,
        platformName: this.metadata.name,
        platformType: this.metadata.type,
        rawTitle: 'Fortune Sunlite Refined Sunflower Oil Pouch (1 L)',
        brand: 'Fortune',
        variant: 'Sunflower Oil',
        weightGrams: 1000,
        price: 132,
        mrp: 165,
        discountPercentage: 20,
        inStock: true,
        productUrl: 'https://flipkart.com/fortune-sunflower-oil/p/itm603',
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
