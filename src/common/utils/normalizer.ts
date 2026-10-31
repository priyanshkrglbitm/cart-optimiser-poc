import { ParsedItemQuery } from '../types/commerce.types';
import { CATALOG } from '../../modules/database/seed/catalog-spec';

export class UniversalNormalizer {
  // Brands from the product catalog, longest first so "tata sampann" wins over "tata".
  // Generic words that are also brand names in the catalog are skipped ("fresh milk" isn't a brand).
  private static KNOWN_BRANDS = [...new Set(CATALOG.flatMap(spec => spec.brands.map(([brand]) => brand.toLowerCase())))]
    .filter(brand => !['fresh', 'organic', 'farm fresh', 'go', 'real', 'modern', 'trust', 'engine', 'society'].includes(brand))
    .sort((a, b) => b.length - a.length);

  public static parseQuery(rawQuery: string): ParsedItemQuery {
    const queryLower = rawQuery.toLowerCase();
    
    let foundBrand: string | undefined = undefined;
    for (const brand of this.KNOWN_BRANDS) {
      if (this.hasWord(queryLower, brand)) {
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
      if (this.hasWord(clean, brand)) clean = clean.replace(brand, '');
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
                  textLower.match(/(?:pack of|box of|pack|box)\s*(\d+)/) ||
                  textLower.match(/^(\d+)\s+[a-z]/); // "12 eggs" (sizes like "5 kg" are read as weight first)
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

  private static hasWord(text: string, word: string): boolean {
    return new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(text);
  }

  private static capitalizeBrand(brand: string): string {
    return brand.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
