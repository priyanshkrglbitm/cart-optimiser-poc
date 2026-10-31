import { Injectable } from '@nestjs/common';
import { LocationContext, ParsedItemQuery, PlatformSearchResult } from '../../common/types/commerce.types';
import { PlatformsService } from '../platforms/platforms.service';

@Injectable()
export class PriceFetcherService {
  constructor(private readonly platformsService: PlatformsService) {}

  /** Searches every store for one already-parsed item. */
  async fetchPrices(query: ParsedItemQuery, location?: LocationContext): Promise<PlatformSearchResult[]> {
    return this.platformsService.platforms.map(platform => {
      const result = this.platformsService.search(platform, query, location);
      const products = [...result.matchedProducts];

      // Requested brand first, then cheapest
      const brand = query.brand?.toLowerCase();
      const isBrand = (title: string, b: string) => !!brand && (b.toLowerCase().includes(brand) || title.toLowerCase().includes(brand));
      products.sort((a, b) =>
        Number(isBrand(b.rawTitle, b.brand)) - Number(isBrand(a.rawTitle, a.brand)) || a.price - b.price
      );

      return { ...result, matchedProduct: products[0] || null, matchedProducts: products };
    });
  }
}
