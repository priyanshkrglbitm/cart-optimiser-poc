import { LocationContext, ParsedItemQuery, PlatformMetadata, PlatformSearchResult, ProductItem } from '../types';
import { BlinkitScraper } from './scrapers/blinkitScraper';
import { ZeptoScraper } from './scrapers/zeptoScraper';
import { InstamartScraper } from './scrapers/instamartScraper';
import { BigBasketScraper } from './scrapers/bigBasketScraper';
import { AmazonFreshScraper } from './scrapers/amazonFreshScraper';
import { FlipkartMinutesScraper } from './scrapers/flipkartMinutesScraper';
import { JioMartScraper } from './scrapers/jioMartScraper';

export interface Platform {
  metadata: PlatformMetadata;
  scraper: { search(query: ParsedItemQuery, location?: LocationContext): Promise<ProductItem[]> };
}

// Every supported store in one place. To add a store: write a scraper, add one row here.
export const PLATFORMS: Platform[] = [
  { metadata: { id: 'blinkit', name: 'Blinkit', type: 'QUICK_COMMERCE', estimatedDelivery: '10-15 mins', baseDeliveryFee: 25, freeDeliveryThreshold: 299 }, scraper: new BlinkitScraper() },
  { metadata: { id: 'zepto', name: 'Zepto', type: 'QUICK_COMMERCE', estimatedDelivery: '10 mins', baseDeliveryFee: 15, freeDeliveryThreshold: 199 }, scraper: new ZeptoScraper() },
  { metadata: { id: 'instamart', name: 'Swiggy Instamart', type: 'QUICK_COMMERCE', estimatedDelivery: '15-20 mins', baseDeliveryFee: 30, freeDeliveryThreshold: 299 }, scraper: new InstamartScraper() },
  { metadata: { id: 'bigbasket', name: 'BigBasket', type: 'QUICK_COMMERCE', estimatedDelivery: '15-25 mins', baseDeliveryFee: 25, freeDeliveryThreshold: 499 }, scraper: new BigBasketScraper() },
  { metadata: { id: 'amazon', name: 'Amazon Fresh', type: 'QUICK_COMMERCE', estimatedDelivery: 'Same Day / 2h', baseDeliveryFee: 49, freeDeliveryThreshold: 499 }, scraper: new AmazonFreshScraper() },
  { metadata: { id: 'flipkart', name: 'Flipkart Minutes', type: 'QUICK_COMMERCE', estimatedDelivery: '10-15 mins', baseDeliveryFee: 15, freeDeliveryThreshold: 199 }, scraper: new FlipkartMinutesScraper() },
  { metadata: { id: 'jiomart', name: 'JioMart', type: 'STANDARD_ECOMMERCE', estimatedDelivery: 'Same Day / 24h', baseDeliveryFee: 0, freeDeliveryThreshold: 0 }, scraper: new JioMartScraper() },
];

/** Searches one store. A crashing scraper returns status ERROR instead of failing the whole basket. */
export async function searchPlatform(
  platform: Platform,
  query: ParsedItemQuery,
  location?: LocationContext
): Promise<PlatformSearchResult> {
  const startTime = Date.now();
  try {
    const items = await platform.scraper.search(query, location);
    return {
      platform: platform.metadata,
      query: query.rawQuery,
      matchedProduct: items[0] || null,
      matchedProducts: items,
      status: items.length > 0 ? 'FOUND' : 'NOT_FOUND',
      latencyMs: Date.now() - startTime,
    };
  } catch (err: any) {
    console.warn(`[${platform.metadata.name}] Scraper failed: ${err.message}`);
    return {
      platform: platform.metadata,
      query: query.rawQuery,
      matchedProduct: null,
      matchedProducts: [],
      status: 'ERROR',
      latencyMs: Date.now() - startTime,
    };
  }
}
