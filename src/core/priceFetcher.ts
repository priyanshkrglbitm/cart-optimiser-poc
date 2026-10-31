import { LocationContext, ParsedItemQuery, PlatformSearchResult } from '../types';
import { PLATFORMS, searchPlatform } from '../platforms';

export class PriceFetcher {
  /** Searches every store in parallel for one already-parsed item. */
  public async fetchPrices(query: ParsedItemQuery, location?: LocationContext): Promise<PlatformSearchResult[]> {
    // Search by generic category (+ size) so other brands show up as alternatives
    let searchText = query.rawQuery;
    if (query.category) {
      searchText = query.category;
      if (query.standardWeightGrams) {
        const grams = query.standardWeightGrams;
        searchText += grams >= 1000 ? ` ${grams / 1000} kg` : ` ${grams} g`;
      }
    }

    return Promise.all(PLATFORMS.map(async platform => {
      const result = await searchPlatform(platform, { ...query, rawQuery: searchText }, location);
      const products = [...new Map(result.matchedProducts.map(p => [p.id, p])).values()];

      // Requested brand first, then cheapest
      const brand = query.brand?.toLowerCase();
      const isBrand = (title: string, b: string) => !!brand && (b.toLowerCase().includes(brand) || title.toLowerCase().includes(brand));
      products.sort((a, b) =>
        Number(isBrand(b.rawTitle, b.brand)) - Number(isBrand(a.rawTitle, a.brand)) || a.price - b.price
      );

      const status: PlatformSearchResult['status'] = result.status === 'ERROR' ? 'ERROR'
        : products.length === 0 ? 'NOT_FOUND'
        : products.some(p => p.inStock) ? 'FOUND' : 'OUT_OF_STOCK';

      return {
        ...result,
        query: query.rawQuery, // the optimizer matches results back to items by the user's original text
        matchedProduct: products[0] || null,
        matchedProducts: products,
        status,
      };
    }));
  }
}
