import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { LocationContext, ProductItem, ParsedItemQuery } from '../../../common/types/commerce.types';
import { UniversalNormalizer } from '../../../common/utils/normalizer';

puppeteer.use(StealthPlugin());

const SESSION_PATH = path.join(__dirname, '..', '..', '..', '..', 'sessions', 'instamart.json');

export class InstamartScraper {
  /**
   * Search for a product on Instamart using Network Interception, HTML Parsing, and Fallback.
   */
  public async search(query: ParsedItemQuery, location?: LocationContext): Promise<ProductItem[]> {
    const queryStr = query.rawQuery;
    const searchUrl = `https://www.swiggy.com/instamart/search?q=${encodeURIComponent(queryStr)}`;
    const platformId = 'instamart';
    const platformName = 'Swiggy Instamart';

    const sessionExists = fs.existsSync(SESSION_PATH);
    console.log(`[InstamartScraper] Launching browser for query: "${queryStr}" [session: ${sessionExists ? '✅ authenticated' : '⚠️ anonymous'}]...`);
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
          let cookiesToSet = session.cookies || [];
          
          if (location && location.latitude && location.longitude) {
             cookiesToSet = cookiesToSet.filter((c: any) => c.name !== 'lat' && c.name !== 'lng');
             cookiesToSet.push({ name: 'lat', value: location.latitude.toString(), domain: '.swiggy.com' });
             cookiesToSet.push({ name: 'lng', value: location.longitude.toString(), domain: '.swiggy.com' });
          }

          if (cookiesToSet.length > 0) {
            await page.setCookie(...cookiesToSet);
          }

          if (session.localStorage && Object.keys(session.localStorage).length > 0) {
            await page.evaluateOnNewDocument((ls: Record<string, string>) => {
              for (const [key, value] of Object.entries(ls)) {
                try { window.localStorage.setItem(key, value); } catch (e) {}
              }
            }, session.localStorage);
          }
        } catch (e: any) {
          console.warn(`[InstamartScraper] ⚠️ Failed to restore session: ${e.message}`);
        }
      } else if (location && location.latitude && location.longitude) {
          await page.setCookie({ name: 'lat', value: location.latitude.toString(), domain: '.swiggy.com' }).catch(() => {});
          await page.setCookie({ name: 'lng', value: location.longitude.toString(), domain: '.swiggy.com' }).catch(() => {});
      }

      if (location) {
        const context = browser.defaultBrowserContext();
        await context.overridePermissions('https://www.swiggy.com', ['geolocation']).catch(() => {});
        await page.setGeolocation({ latitude: location.latitude, longitude: location.longitude }).catch(() => {});
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

      console.log(`[InstamartScraper] Navigating to ${searchUrl}...`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

      await new Promise(r => setTimeout(r, 4000));
      pageHtml = await page.content().catch(() => '');

    } catch (err: any) {
      console.error(`[InstamartScraper] Browser error: ${err.message}`);
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
        const name = obj.name || obj.title || obj.productName || obj.product_name || obj.display_name;
        const priceObj = obj.price || obj.sellingPrice || obj.selling_price || obj.offer_price;
        
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

    // 3. Fallback: Parse HTML if JSON failed
    if (items.length === 0 && pageHtml) {
      try {
        const $ = cheerio.load(pageHtml);
        $('[data-testid="item-card"], div[class*="item-card"], div[class*="ProductCard"]').each((_, el) => {
          const title = $(el).find('[data-testid="item-name"], [class*="itemName"], h3').text().trim();
          const priceText = $(el).find('[data-testid="item-price"], [class*="price"]').text().trim();
          const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
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
              mrp: price,
              discountPercentage: 0,
              inStock: true,
              inStockQuantity: 10,
              productUrl: searchUrl,
              imageUrl: $(el).find('img').attr('src') || '',
              fingerprint: UniversalNormalizer.generateFingerprint('Unknown', title, 0),
              confidenceScore: 0.90
            });
          }
        });
      } catch (_) {}
    }


    console.log(`[InstamartScraper] Extracted ${items.length} products!`);
    if (items.length > 0) {
        console.log(`[InstamartScraper] Top match: ${items[0].rawTitle} - ₹${items[0].price}`);
    }

    return items.slice(0, 15);
  }
}
