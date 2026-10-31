import { ParsedItemQuery, ProductItem } from '../types';

export class UniversalNormalizer {
  private static KNOWN_BRANDS = [
    'tata sampann', 'tata', 'fortune', 'amul', 'aashirvaad', 
    'logitech', 'samsung', 'dabbing', 'dabur', 'saffola', 
    'mdh', 'everest', 'surf excel', 'ariel', 'nestle', 'cadbury'
  ];

  public static parseQuery(rawQuery: string): ParsedItemQuery {
    const queryLower = rawQuery.toLowerCase();
    
    let foundBrand: string | undefined = undefined;
    for (const brand of this.KNOWN_BRANDS) {
      if (queryLower.includes(brand)) {
        foundBrand = this.capitalizeBrand(brand);
        break;
      }
    }

    const weightGrams = this.extractWeightInGrams(rawQuery);
    const pieceCount = this.extractPieceCount(rawQuery);
    const category = this.cleanCategory(rawQuery);

    return {
      rawQuery,
      brand: foundBrand,
      category: category || undefined,
      standardWeightGrams: weightGrams,
      quantityValue: weightGrams ? (weightGrams >= 1000 ? weightGrams / 1000 : weightGrams) : pieceCount,
      quantityUnit: weightGrams ? (weightGrams >= 1000 ? 'kg' : 'g') : (pieceCount ? 'pcs' : undefined)
    };
  }

  public static cleanCategory(text: string): string {
    // Strip brand names if known
    let clean = text.toLowerCase();
    for (const brand of this.KNOWN_BRANDS) {
      clean = clean.replace(brand, '');
    }

    return clean
      .replace(/(\d+(?:\.\d+)?)\s*(?:kilograms?|kilo|kg|grams?|gms?|g|litres?|liters?|ltr|l|milliliters?|ml)\b/gi, '')
      .replace(/(\d+)\s*(?:pcs|pc|piece|pieces|unit|units|pack|box|items|pack of)/gi, '')
      .replace(/(?:pack of|box of|pack|box)\s*(\d+)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public static extractPieceCount(text: string): number | undefined {
    const textLower = text.toLowerCase();
    
    // e.g. "12 unit", "12 piece", "pack of 12", "6 pack", "10 items"
    const match = textLower.match(/(\d+)\s*(?:pcs|pc|piece|pieces|unit|units|pack|box|items|pack of)/) || 
                  textLower.match(/(?:pack of|box of|pack|box)\s*(\d+)/);
    if (match) return parseInt(match[1] || match[2], 10);
    return undefined;
  }

  public static extractWeightInGrams(text: string): number | undefined {
    const textLower = text.toLowerCase();
    
    const kgMatch = textLower.match(/(\d+(?:\.\d+)?)\s*(?:kilograms?|kilo|kg)\b/);
    if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);

    const gMatch = textLower.match(/(\d+)\s*(?:grams?|gms?|g)\b/);
    if (gMatch) return parseInt(gMatch[1], 10);

    const literMatch = textLower.match(/(\d+(?:\.\d+)?)\s*(?:litres?|liters?|ltr|l)\b/);
    if (literMatch) return Math.round(parseFloat(literMatch[1]) * 1000);

    const mlMatch = textLower.match(/(\d+)\s*(?:milliliters?|ml)\b/);
    if (mlMatch) return parseInt(mlMatch[1], 10);

    return undefined;
  }

  public static generateFingerprint(brand: string, title: string, weightGrams?: number): string {
    const brandClean = brand.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    
    let variantClean = title.toLowerCase()
      .replace(brand.toLowerCase(), '')
      .replace(/(\d+(?:\.\d+)?)\s*(?:kg|g|gm|l|ml|ltr)/gi, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .trim();

    if (variantClean.includes('arhar') || variantClean.includes('toor')) {
      variantClean = 'TOOR_DAL';
    } else if (variantClean.includes('butter')) {
      variantClean = 'BUTTER';
    } else if (variantClean.includes('sunflower') || variantClean.includes('oil')) {
      variantClean = 'SUNFLOWER_OIL';
    } else if (variantClean.includes('atta') || variantClean.includes('flour')) {
      variantClean = 'WHEAT_ATTA';
    }

    const weightTag = weightGrams ? `${weightGrams}G` : 'STD';
    return `${brandClean}_${variantClean}_${weightTag}`.toUpperCase();
  }

  private static capitalizeBrand(brand: string): string {
    return brand.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /** In stock unless the store's data explicitly says it isn't. */
  public static isInStock(obj: any): boolean {
    return !(
      obj.inventory === 0 || obj.inStock === false || obj.in_stock === false || obj.available === false ||
      obj.outOfStock === true || obj.out_of_stock === true || obj.availability_status === 'OUT_OF_STOCK'
    );
  }
}
