export type PlatformType = 'QUICK_COMMERCE' | 'STANDARD_ECOMMERCE';

export interface LocationContext {
  latitude: number;
  longitude: number;
  pincode?: string;
  address?: string;
  city?: string;
}

export interface PlatformMetadata {
  id: string;
  name: string;
  type: PlatformType;
  estimatedDelivery: string;
  baseDeliveryFee: number;
  freeDeliveryThreshold: number;   // no delivery fee at or above this subtotal
  handlingFee: number;             // every order
  platformFee: number;             // every order
  smallCartFee: number;
  smallCartThreshold: number;      // small-cart fee below this subtotal
}

/** Everything a store adds on top of the items, for one order. */
export interface FeeBreakdown {
  delivery: number;
  handling: number;
  platform: number;
  smallCart: number;
  total: number;
}

export interface ParsedItemQuery {
  rawQuery: string;
  brand?: string;
  category?: string;
  variant?: string;
  quantityValue?: number;
  quantityUnit?: string;
  standardWeightGrams?: number;
  location?: LocationContext;
}

export interface ProductItem {
  id: string;
  platformId: string;
  platformName: string;
  platformType: PlatformType;
  rawTitle: string;
  brand: string;
  variant: string;
  weightGrams?: number;
  volumeMl?: number;
  unitPriceNormalized?: number; // Price per 100g or 100ml
  price: number;
  mrp: number;
  discountPercentage: number;
  inStock: boolean;
  inStockQuantity?: number;
  productUrl: string;
  imageUrl?: string;
  fingerprint: string;
  confidenceScore: number;
  rating?: number;       // out of 5
  reviewCount?: number;
  multiplier?: number;
  isSubstituted?: boolean;
}

export interface PlatformSearchResult {
  platform: PlatformMetadata;
  query: string;
  matchedProduct: ProductItem | null;
  matchedProducts: ProductItem[]; // Multi-variant list of all matching items in stock
  status: 'FOUND' | 'OUT_OF_STOCK' | 'NOT_FOUND' | 'ERROR';
  latencyMs: number;
}

export interface PlatformBasketSummary {
  platform: PlatformMetadata;
  foundItemsCount: number;
  totalRequestedItems: number;
  subtotalPrice: number;
  fees: FeeBreakdown;
  totalCost: number;   // items + all fees
  isFullyAvailable: boolean;
  items: (ProductItem | null)[];
  alternatives?: (ProductItem[])[];
}

export interface SplitCartRecommendation {
  savingsVersusBestSinglePlatform: number;
  optimizedTotalCost: number; // items + all fees
  fees: { platform: string; fees: FeeBreakdown }[];
  assignments: {
    itemQuery: string;
    chosenPlatform: string;
    product: ProductItem;
    itemPrice: number;
  }[];
}

export interface UniversalBasketResponse {
  location?: LocationContext;
  queryItems: ParsedItemQuery[];
  quickCommerceTotalBest: PlatformBasketSummary | null;
  standardECommerceTotalBest: PlatformBasketSummary | null;
  overallBestSinglePlatform: PlatformBasketSummary | null;
  splitCartRecommendation: SplitCartRecommendation;
  platformSummaries: PlatformBasketSummary[];
  agentLogs: string[];
}

