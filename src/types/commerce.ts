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
  freeDeliveryThreshold: number;
  iconSvg?: string;
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
  deliveryFee: number;
  totalCost: number;
  isFullyAvailable: boolean;
  items: (ProductItem | null)[];
  alternatives?: (ProductItem[])[];
}

export interface SplitCartRecommendation {
  savingsVersusBestSinglePlatform: number;
  optimizedTotalCost: number;
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

export interface ICommerceAgent {
  metadata: PlatformMetadata;
  searchProduct(query: ParsedItemQuery, location?: LocationContext): Promise<PlatformSearchResult>;
}

