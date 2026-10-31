import { Injectable } from '@nestjs/common';
import {
  LocationContext,
  ParsedItemQuery,
  PlatformMetadata,
  PlatformSearchResult,
  ProductItem,
} from '../../common/types/commerce.types';
import { DatabaseService } from '../database/database.service';

interface ListingRow {
  product_id: number;
  name: string;
  brand: string;
  variant: string;
  size_value: number;
  size_unit: 'g' | 'ml' | 'pc';
  price: number;
  mrp: number;
  in_stock: number;
  rating: number;
  review_count: number;
}

const SIZE_WORDS = new Set(['g', 'gm', 'kg', 'ml', 'l', 'ltr', 'litre', 'liter', 'pc', 'pcs', 'pack', 'of', 'x']);

/**
 * Stores and their prices, read from the price database (src/modules/database).
 * The database holds SAMPLE data today; a real price source would replace it behind the same methods.
 */
@Injectable()
export class PlatformsService {
  constructor(private readonly database: DatabaseService) {}

  get platforms(): PlatformMetadata[] {
    return (this.database.db.prepare('SELECT * FROM platforms ORDER BY rowid').all() as any[]).map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      estimatedDelivery: row.eta,
      baseDeliveryFee: row.delivery_fee,
      freeDeliveryThreshold: row.free_delivery_above,
      handlingFee: row.handling_fee,
      platformFee: row.platform_fee,
      smallCartFee: row.small_cart_fee,
      smallCartThreshold: row.small_cart_below,
    }));
  }

  findById(id: string): PlatformMetadata | undefined {
    return this.platforms.find(p => p.id === id);
  }

  /**
   * Finds one list item at one store. Tries the item as an exact product type first ("butter", "doodh"),
   * then every word of it in the product names, so "milk" doesn't return milk chocolate.
   */
  // shortcut: sample data has one price per store for every pincode. A real source would use location.pincode.
  search(platform: PlatformMetadata, query: ParsedItemQuery, _location?: LocationContext): PlatformSearchResult {
    const startTime = Date.now();
    const phrase = (query.category || query.rawQuery).toLowerCase().replace(/[^a-z0-9 &'-]/g, ' ').replace(/\s+/g, ' ').trim();
    const brand = `%${(query.brand || '').toLowerCase().replace(/[^a-z0-9 &'-]/g, '')}%`;

    const select = (where: string, ...params: string[]) =>
      this.database.db.prepare(`
        SELECT l.product_id, p.name, p.brand, p.variant, p.size_value, p.size_unit,
               l.price, l.mrp, l.in_stock, l.rating, l.review_count
        FROM listings l JOIN products p ON p.id = l.product_id
        WHERE l.platform_id = ? AND ${where}
        ORDER BY (? <> '%%' AND lower(p.brand) LIKE ?) DESC, l.price ASC
        LIMIT 50`).all(platform.id, ...params, brand, brand) as unknown as ListingRow[];

    let rows = phrase ? select('p.keywords LIKE ?', `%|${phrase}|%`) : [];
    if (rows.length === 0) {
      const words = phrase.split(' ').filter(w => w.length > 1 && !/^\d/.test(w) && !SIZE_WORDS.has(w));
      if (words.length) rows = select(words.map(() => 'p.search_text LIKE ?').join(' AND '), ...words.map(w => `%${w}%`));
    }

    const items = rows.map(row => this.toProductItem(platform, row));
    return {
      platform,
      query: query.rawQuery,
      matchedProduct: items[0] || null,
      matchedProducts: items,
      status: items.length === 0 ? 'NOT_FOUND' : items.some(i => i.inStock) ? 'FOUND' : 'OUT_OF_STOCK',
      latencyMs: Date.now() - startTime,
    };
  }

  private toProductItem(platform: PlatformMetadata, row: ListingRow): ProductItem {
    const { size_value: size, size_unit: unit } = row;
    return {
      id: `${platform.id}_${row.product_id}`,
      platformId: platform.id,
      platformName: platform.name,
      platformType: platform.type,
      rawTitle: `${row.name}, ${formatSize(size, unit)}`,
      brand: row.brand,
      variant: row.variant,
      weightGrams: unit === 'g' ? size : undefined,
      volumeMl: unit === 'ml' ? size : undefined,
      unitPriceNormalized: unit === 'pc' ? row.price / size : (row.price / size) * 100, // per piece, or per 100 g/ml
      price: row.price,
      mrp: row.mrp,
      discountPercentage: Math.round(((row.mrp - row.price) / row.mrp) * 100),
      inStock: row.in_stock === 1,
      productUrl: '',
      fingerprint: `P${row.product_id}`, // same product on every store shares this
      confidenceScore: 1,
      rating: row.rating,
      reviewCount: row.review_count,
    };
  }
}

function formatSize(size: number, unit: 'g' | 'ml' | 'pc'): string {
  if (unit === 'pc') return `${size} pcs`;
  if (size >= 1000) return `${size / 1000} ${unit === 'g' ? 'kg' : 'L'}`;
  return `${size} ${unit}`;
}
