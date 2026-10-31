// Stores and their fees. Fee amounts are SAMPLE values for the demo, not the platforms' real fees.

export interface PlatformSpec {
  id: string;
  name: string;
  type: 'QUICK_COMMERCE' | 'STANDARD_ECOMMERCE';
  eta: string;
  deliveryFee: number;
  freeDeliveryAbove: number; // no delivery fee at or above this subtotal
  handlingFee: number;       // charged on every order
  platformFee: number;       // charged on every order
  smallCartFee: number;
  smallCartBelow: number;    // small-cart fee when subtotal is below this
  // How the generator prices this store
  avgDiscount: number;       // average discount off MRP, e.g. 0.1 = 10%
  availability: number;      // share of the catalog this store carries
}

export const PLATFORMS: PlatformSpec[] = [
  { id: 'blinkit', name: 'Blinkit', type: 'QUICK_COMMERCE', eta: '10-15 mins', deliveryFee: 30, freeDeliveryAbove: 199, handlingFee: 4, platformFee: 2, smallCartFee: 20, smallCartBelow: 99, avgDiscount: 0.08, availability: 0.9 },
  { id: 'zepto', name: 'Zepto', type: 'QUICK_COMMERCE', eta: '10 mins', deliveryFee: 25, freeDeliveryAbove: 149, handlingFee: 3, platformFee: 5, smallCartFee: 25, smallCartBelow: 99, avgDiscount: 0.1, availability: 0.88 },
  { id: 'instamart', name: 'Swiggy Instamart', type: 'QUICK_COMMERCE', eta: '15-20 mins', deliveryFee: 35, freeDeliveryAbove: 299, handlingFee: 5, platformFee: 0, smallCartFee: 15, smallCartBelow: 149, avgDiscount: 0.09, availability: 0.87 },
  { id: 'bigbasket', name: 'BigBasket BB Now', type: 'QUICK_COMMERCE', eta: '15-25 mins', deliveryFee: 30, freeDeliveryAbove: 299, handlingFee: 0, platformFee: 3, smallCartFee: 0, smallCartBelow: 0, avgDiscount: 0.12, availability: 0.92 },
  { id: 'flipkart', name: 'Flipkart Minutes', type: 'QUICK_COMMERCE', eta: '10-15 mins', deliveryFee: 25, freeDeliveryAbove: 249, handlingFee: 3, platformFee: 0, smallCartFee: 20, smallCartBelow: 99, avgDiscount: 0.11, availability: 0.8 },
  { id: 'jiomart', name: 'JioMart Quick', type: 'QUICK_COMMERCE', eta: '15-30 mins', deliveryFee: 25, freeDeliveryAbove: 199, handlingFee: 0, platformFee: 0, smallCartFee: 0, smallCartBelow: 0, avgDiscount: 0.13, availability: 0.85 },
];
