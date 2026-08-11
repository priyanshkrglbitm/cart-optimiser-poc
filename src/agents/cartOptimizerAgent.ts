import { 
  PlatformSearchResult, 
  PlatformBasketSummary, 
  SplitCartRecommendation, 
  ProductItem, 
  ParsedItemQuery 
} from '../types/commerce';
import { UniversalNormalizer } from '../services/universalNormalizer';

export class CartOptimizerAgent {
  public static calculatePlatformSummaries(
    queries: ParsedItemQuery[],
    allResults: PlatformSearchResult[]
  ): PlatformBasketSummary[] {
    const platformMap = new Map<string, PlatformSearchResult[]>();

    for (const res of allResults) {
      const pid = res.platform.id;
      if (!platformMap.has(pid)) {
        platformMap.set(pid, []);
      }
      platformMap.get(pid)!.push(res);
    }

    const summaries: PlatformBasketSummary[] = [];

    for (const [_, results] of platformMap.entries()) {
      const platformMeta = results[0].platform;
      let foundCount = 0;
      let subtotal = 0;
      const matchedItems: (ProductItem | null)[] = [];
      const alternativesList: (ProductItem[])[] = [];

      for (const query of queries) {
        const matchingResult = results.find(r => r.query === query.rawQuery);

        // Extract available in-stock items from matchedProducts or matchedProduct
        const availableItems: ProductItem[] = [];
        if (matchingResult) {
          if (matchingResult.matchedProducts && matchingResult.matchedProducts.length > 0) {
            availableItems.push(...matchingResult.matchedProducts.filter(p => p.inStock));
          } else if (matchingResult.matchedProduct && matchingResult.matchedProduct.inStock) {
            availableItems.push(matchingResult.matchedProduct);
          }
        }

        if (availableItems.length > 0) {
          const candidatesWithCost = availableItems.map(p => {
            let multiplier = 1;
            
            // 1. Calculate weight multiplier
            if (query.standardWeightGrams && query.standardWeightGrams > 0) {
              const itemWeight = p.weightGrams || p.volumeMl || UniversalNormalizer.extractWeightInGrams(p.rawTitle) || 0;
              if (itemWeight > 0) {
                multiplier = Math.ceil(query.standardWeightGrams / itemWeight);
              }
            } 
            // 2. Calculate piece/unit multiplier
            else if (query.quantityUnit === 'pcs' && query.quantityValue && query.quantityValue > 0) {
              const itemPieces = UniversalNormalizer.extractPieceCount(p.rawTitle) || 1;
              multiplier = Math.ceil(query.quantityValue / itemPieces);
            }

            if (multiplier < 1) multiplier = 1;

            const isSubstituted = query.brand 
              ? !p.brand.toLowerCase().includes(query.brand.toLowerCase()) && !p.rawTitle.toLowerCase().includes(query.brand.toLowerCase())
              : false;

            return {
              product: p,
              multiplier,
              isSubstituted,
              totalCost: p.price * multiplier
            };
          });

          // Sort by lowest normalized total cost
          candidatesWithCost.sort((a, b) => a.totalCost - b.totalCost);

          const best = candidatesWithCost[0];
          const bestProduct: ProductItem = {
            ...best.product,
            multiplier: best.multiplier,
            isSubstituted: best.isSubstituted
          };
          
          foundCount++;
          subtotal += best.totalCost;
          matchedItems.push(bestProduct);

          // Mapped alternatives
          alternativesList.push(candidatesWithCost.map(c => ({
            ...c.product,
            multiplier: c.multiplier,
            isSubstituted: c.isSubstituted
          })));
        } else {
          matchedItems.push(null);
          alternativesList.push([]);
        }
      }

      let deliveryFee = 0;
      if (subtotal > 0 && subtotal < platformMeta.freeDeliveryThreshold) {
        deliveryFee = platformMeta.baseDeliveryFee;
      }

      summaries.push({
        platform: platformMeta,
        foundItemsCount: foundCount,
        totalRequestedItems: queries.length,
        subtotalPrice: subtotal,
        deliveryFee: deliveryFee,
        totalCost: subtotal + deliveryFee,
        isFullyAvailable: foundCount === queries.length,
        items: matchedItems,
        alternatives: alternativesList
      });
    }

    return summaries.sort((a, b) => {
      if (a.isFullyAvailable && !b.isFullyAvailable) return -1;
      if (!a.isFullyAvailable && b.isFullyAvailable) return 1;
      return a.totalCost - b.totalCost;
    });
  }

  public static calculateSplitCart(
    queries: ParsedItemQuery[],
    allResults: PlatformSearchResult[],
    bestSinglePlatformCost: number
  ): SplitCartRecommendation {
    const assignments: SplitCartRecommendation['assignments'] = [];
    let splitTotal = 0;

    for (const query of queries) {
      const candidates: { platformName: string; product: ProductItem; totalCost: number; multiplier: number; isSubstituted: boolean }[] = [];

      for (const res of allResults) {
        if (res.query === query.rawQuery) {
          const inStock = (res.matchedProducts || [res.matchedProduct])
            .filter((p): p is ProductItem => p !== null && p.inStock);

          for (const item of inStock) {
            let multiplier = 1;
            
            // 1. Calculate weight multiplier
            if (query.standardWeightGrams && query.standardWeightGrams > 0) {
              const itemWeight = item.weightGrams || item.volumeMl || UniversalNormalizer.extractWeightInGrams(item.rawTitle) || 0;
              if (itemWeight > 0) {
                multiplier = Math.ceil(query.standardWeightGrams / itemWeight);
              }
            } 
            // 2. Calculate piece/unit multiplier
            else if (query.quantityUnit === 'pcs' && query.quantityValue && query.quantityValue > 0) {
              const itemPieces = UniversalNormalizer.extractPieceCount(item.rawTitle) || 1;
              multiplier = Math.ceil(query.quantityValue / itemPieces);
            }

            if (multiplier < 1) multiplier = 1;

            const isSubstituted = query.brand 
              ? !item.brand.toLowerCase().includes(query.brand.toLowerCase()) && !item.rawTitle.toLowerCase().includes(query.brand.toLowerCase())
              : false;

            candidates.push({
              platformName: res.platform.name,
              product: {
                ...item,
                multiplier,
                isSubstituted
              },
              totalCost: item.price * multiplier,
              multiplier,
              isSubstituted
            });
          }
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => a.totalCost - b.totalCost);
        const bestCandidate = candidates[0];

        assignments.push({
          itemQuery: query.rawQuery,
          chosenPlatform: bestCandidate.platformName,
          product: bestCandidate.product,
          itemPrice: bestCandidate.totalCost
        });

        splitTotal += bestCandidate.totalCost;
      }
    }

    const savings = Math.max(0, bestSinglePlatformCost - splitTotal);

    return {
      savingsVersusBestSinglePlatform: savings,
      optimizedTotalCost: splitTotal,
      assignments
    };
  }
}

