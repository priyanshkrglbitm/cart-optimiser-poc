import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { LocationContext, ProductItem, ParsedItemQuery } from '../../types';
import { UniversalNormalizer } from '../../core/normalizer';

puppeteer.use(StealthPlugin());

const SESSION_PATH = path.join(__dirname, '..', '..', '..', 'sessions', 'amazon.json');

export class AmazonFreshScraper {
  /**
   * Search for a product on Amazon Fresh using Network Interception, DOM Parsing, and Fallback.
   */
  public async search(query: ParsedItemQuery, location?: LocationContext): Promise<ProductItem[]> {
    const queryStr = query.rawQuery;
    const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(queryStr)}&i=nowstore`;
    const platformId = 'amazon';
    const platformName = 'Amazon Fresh';

    const sessionExists = fs.existsSync(SESSION_PATH);
    console.log(`[AmazonFreshScraper] Launching browser for query: "${queryStr}" [session: ${sessionExists ? '✅ authenticated' : '⚠️ anonymous'}]...`);
    let browser: any = null;
    const interceptedData: any[] = [];
    let pageHtml = '';

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      // ── Restore authenticated session if available ──────────────────────────
      if (sessionExists) {
        try {
          const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'));
          if (session.cookies && session.cookies.length > 0) {
            await page.setCookie(...session.cookies);
          }
          await page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          if (session.localStorage && Object.keys(session.localStorage).length > 0) {
            await page.evaluate((ls: Record<string, string>) => {
              for (const [key, value] of Object.entries(ls)) {
                window.localStorage.setItem(key, value);
              }
            }, session.localStorage).catch(() => {});
          }
        } catch (e: any) {
          console.warn(`[AmazonFreshScraper] ⚠️ Failed to restore session: ${e.message}`);
        }
      }

      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const resourceType = req.resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // 1. Capture ALL JSON responses!
      page.on('response', async (response: any) => {
        if (response.request().method() !== 'OPTIONS' && response.status() === 200) {
          try {
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('application/json')) {
              const json = await response.json();
              interceptedData.push({ url: response.url(), data: json });
            }
          } catch (e) {}
        }
      });

      console.log(`[AmazonFreshScraper] Navigating to ${searchUrl}...`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 4000));
      pageHtml = await page.content().catch(() => '');

    } catch (err: any) {
      console.error(`[AmazonFreshScraper] Browser error: ${err.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    // 2. Adaptive JSON Parser
    const items: ProductItem[] = [];
    const foundProductNames = new Set<string>();

    function extractProductsRecursive(obj: any) {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        for (let item of obj) extractProductsRecursive(item);
      } else {
        const name = obj.name || obj.title || obj.productName || obj.product_name;
        const priceObj = obj.price || obj.sellingPrice || obj.selling_price || obj.final_price || obj.offer_price;
        
        let price = -1;
        if (typeof priceObj === 'number') price = priceObj;
        else if (typeof priceObj === 'string') price = parseFloat(priceObj.replace(/[^0-9.]/g, ''));

        if (name && typeof name === 'string' && name.length > 2 && price > 0) {
            const mrpObj = obj.mrp || obj.originalPrice || obj.original_price || obj.price || price;
            let mrp = -1;
            if (typeof mrpObj === 'number') mrp = mrpObj;
            else if (typeof mrpObj === 'string') mrp = parseFloat(mrpObj.replace(/[^0-9.]/g, ''));
            if (isNaN(mrp) || mrp < price) mrp = price;

            if (price > 1000 && Number.isInteger(price)) { 
                price = price / 100;
                mrp = mrp / 100;
            }

            if (!foundProductNames.has(name)) {
                foundProductNames.add(name);
                items.push({
                    id: `${platformId}_api_${items.length}`,
                    platformId: platformId,
                    platformName: platformName,
                    platformType: 'QUICK_COMMERCE',
                    rawTitle: name,
                    brand: obj.brand || 'Unknown',
                    variant: name,
                    volumeMl: 0,
                    weightGrams: 0,
                    unitPriceNormalized: price,
                    price: price,
                    mrp: mrp,
                    discountPercentage: Math.round(((mrp - price) / mrp) * 100) || 0,
                    inStock: UniversalNormalizer.isInStock(obj),
                    inStockQuantity: obj.inventory || obj.quantity || 10,
                    productUrl: searchUrl,
                    imageUrl: obj.image_url || obj.imageUrl || (obj.images && obj.images[0]) || '',
                    fingerprint: UniversalNormalizer.generateFingerprint('Unknown', name, 0),
                    confidenceScore: 0.95
                });
            }
        } else {
            for (let key in obj) {
                if (key !== 'parent' && key !== 'config') extractProductsRecursive(obj[key]);
            }
        }
      }
    }

    extractProductsRecursive(interceptedData);

    // 3. Fallback: Parse HTML DOM (cheerio)
    if (items.length === 0 && pageHtml) {
      try {
        const $ = cheerio.load(pageHtml);
        $('div[data-component-type="s-search-result"], div.s-result-item[data-asin]').each((_, el) => {
          const title = $(el).find('h2 a span, h2 span, a.a-link-normal span.a-text-normal').first().text().trim();
          const priceWhole = $(el).find('span.a-price-whole').first().text().trim().replace(/[,.]/g, '');
          const mrpText = $(el).find('span.a-price.a-text-price span.a-offscreen, span.a-text-strike').first().text().trim();
          
          const price = parseFloat(priceWhole);
          const mrp = parseFloat(mrpText.replace(/[^0-9.]/g, '')) || price;

          if (title && price > 0 && !foundProductNames.has(title)) {
            foundProductNames.add(title);
            items.push({
              id: `${platformId}_dom_${items.length}`,
              platformId,
              platformName,
              platformType: 'QUICK_COMMERCE',
              rawTitle: title,
              brand: 'Unknown',
              variant: title,
              volumeMl: 0,
              weightGrams: 0,
              unitPriceNormalized: price,
              price,
              mrp: Math.max(mrp, price),
              discountPercentage: Math.round(((mrp - price) / mrp) * 100) || 0,
              inStock: true,
              inStockQuantity: 10,
              productUrl: searchUrl,
              imageUrl: $(el).find('img.s-image').attr('src') || '',
              fingerprint: UniversalNormalizer.generateFingerprint('Unknown', title, 0),
              confidenceScore: 0.90
            });
          }
        });
      } catch (_) {}
    }


    console.log(`[AmazonFreshScraper] Extracted ${items.length} products!`);
    if (items.length > 0) {
        console.log(`[AmazonFreshScraper] Top match: ${items[0].rawTitle} - ₹${items[0].price}`);
    }

    return items.slice(0, 15);
  }
}
