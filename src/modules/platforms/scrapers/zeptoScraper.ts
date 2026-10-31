import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import { LocationContext, ProductItem, ParsedItemQuery } from '../../../common/types/commerce.types';
import { UniversalNormalizer } from '../../../common/utils/normalizer';

puppeteer.use(StealthPlugin());

const SESSION_PATH = path.join(__dirname, '..', '..', '..', '..', 'sessions', 'zepto.json');

export class ZeptoScraper {
  /**
   * Search for a product on Zepto.
   * Strategy 1 (preferred): Call Zepto BFF search API directly using cookies from saved session.
   * Strategy 2 (fallback): Navigate search page and intercept JSON responses.
   */
  public async search(query: ParsedItemQuery, location?: LocationContext): Promise<ProductItem[]> {
    const queryStr = query.rawQuery;
    const platformId = 'zepto';
    const searchUrl = `https://www.zeptonow.com/search?q=${encodeURIComponent(queryStr)}`;

    const sessionExists = fs.existsSync(SESSION_PATH);
    console.log(`[ZeptoScraper] Launching browser for query: "${queryStr}" [session: ${sessionExists ? '✅ authenticated' : '⚠️ anonymous'}]...`);

    // ── Strategy 1: Direct BFF API call using session ──────────────────────────
    if (sessionExists) {
      try {
        const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'));
        const cookies: Record<string, string> = {};
        for (const c of (session.cookies || [])) {
          cookies[c.name] = c.value;
        }

        const lat = location?.latitude ?? parseFloat(cookies['latitude'] || '0');
        const lng = location?.longitude ?? parseFloat(cookies['longitude'] || '0');

        // Extract storeId from serviceability cookie
        let storeId = '';
        try {
          const svc = decodeURIComponent(cookies['serviceability'] || '{}');
          const svcData = JSON.parse(svc);
          storeId = svcData?.primaryStore?.storeId || '';
        } catch (_) {}

        if (storeId && cookies['accessToken']) {
          console.log(`[ZeptoScraper] Using direct BFF API (storeId: ${storeId.substring(0, 8)}...)`);

          const cookieHeader = Object.entries(cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');

          const apiUrl = `https://api.zeptonow.com/api/v3/search?query=${encodeURIComponent(queryStr)}&page_number=1&page_size=20&mode=AUTOSUGGEST_SEARCH&is_for_recent_searches=false&store_id=${storeId}&latitude=${lat}&longitude=${lng}&version=9`;

          const resp = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'appversion': '10.45.1',
              'Content-Type': 'application/json',
              'Cookie': cookieHeader,
              'Origin': 'https://www.zeptonow.com',
              'Referer': searchUrl,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              'marketplace': 'ZEPTO',
              'requestid': `web_${Date.now()}`,
              'source': 'WEB',
              'store_id': storeId,
            }
          });

          if (resp.ok) {
            const data = await resp.json();
            const items = this.parseZeptoApiResponse(data, platformId, searchUrl);
            console.log(`[ZeptoScraper] Direct API: Extracted ${items.length} products!`);
            if (items.length > 0) {
              console.log(`[ZeptoScraper] Top match: ${items[0].rawTitle} - ₹${items[0].price}`);
              return items.slice(0, 15);
            } else {
              console.log(`[ZeptoScraper] Direct API returned 0 items, falling back to browser scrape...`);
              console.log(`[ZeptoScraper] API Response snippet: ${JSON.stringify(data).substring(0, 400)}`);
            }
          } else {
            const errText = await resp.text().catch(() => '');
            console.warn(`[ZeptoScraper] Direct API failed: HTTP ${resp.status} — ${errText.substring(0, 200)}`);
          }
        }
      } catch (e: any) {
        console.warn(`[ZeptoScraper] Direct API error: ${e.message} — falling back to browser.`);
      }
    }

    // ── Strategy 2: Browser-based session scraping (fallback) ──────────────────
    let browser: any = null;
    const interceptedData: any[] = [];

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      if (sessionExists) {
        try {
          const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'));
          if (session.cookies && session.cookies.length > 0) {
            await page.setCookie(...session.cookies);
          }
          await page.goto('https://www.zeptonow.com', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          if (session.localStorage && Object.keys(session.localStorage).length > 0) {
            try {
              await page.evaluate((ls: Record<string, string>) => {
                for (const [key, value] of Object.entries(ls)) {
                  window.localStorage.setItem(key, value);
                }
              }, session.localStorage);
            } catch (e: any) {
              console.warn(`[ZeptoScraper] ⚠️ evaluate failed: ${e.message}`);
            }
          }
        } catch (e: any) {
          console.warn(`[ZeptoScraper] ⚠️ Failed to restore session: ${e.message}`);
        }
      }

      if (location) {
        const context = browser.defaultBrowserContext();
        await context.overridePermissions('https://www.zeptonow.com', ['geolocation']);
        await page.setGeolocation({ latitude: location.latitude, longitude: location.longitude });
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

      page.on('response', async (response: any) => {
        const url: string = response.url();
        if (response.request().method() !== 'OPTIONS' && response.status() === 200 &&
            (url.includes('/search') || url.includes('api.zepto'))) {
          try {
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('application/json')) {
              const json = await response.json();
              interceptedData.push({ url, data: json });
            }
          } catch (e) {}
        }
      });

      console.log(`[ZeptoScraper] Navigating to ${searchUrl}...`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e: any) => console.log(`[ZeptoScraper] Goto warning: ${e.message}`));
      await new Promise(r => setTimeout(r, 6000));

      const embeddedJson = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/json"], script#__NEXT_DATA__'));
        return scripts.map((s: any) => {
          try { return JSON.parse(s.innerHTML || ''); } catch (e) { return null; }
        }).filter(Boolean);
      });
      if (embeddedJson && embeddedJson.length > 0) {
        interceptedData.push(...embeddedJson);
      }

    } catch (err: any) {
      console.error(`[ZeptoScraper] Browser error: ${err.message}`);
    } finally {
      if (browser) await browser.close();
    }

    let items = this.parseZeptoApiResponse(interceptedData, platformId, searchUrl);


    console.log(`[ZeptoScraper] Extracted ${items.length} products!`);
    if (items.length > 0) {
      console.log(`[ZeptoScraper] Top match: ${items[0].rawTitle} - ₹${items[0].price}`);
    }

    return items.slice(0, 15);
  }

  private parseZeptoApiResponse(data: any, platformId: string, searchUrl: string): ProductItem[] {
    const items: ProductItem[] = [];
    const foundProductNames = new Set<string>();

    function extractProductsRecursive(obj: any) {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        for (const item of obj) extractProductsRecursive(item);
      } else {
        const name = obj.name || obj.title || obj.productName || obj.product_name;
        // Zepto uses 'discountedPrice' for selling price (in paise) and 'mrp' for original price
        const priceObj = obj.discountedPrice || obj.price || obj.sellingPrice || obj.selling_price;

        let price = -1;
        if (typeof priceObj === 'number') price = priceObj;
        else if (typeof priceObj === 'string') price = parseFloat(priceObj.replace(/[^0-9.]/g, ''));

        if (name && typeof name === 'string' && name.length > 2 && price > 0) {
          const mrpObj = obj.mrp || obj.originalPrice || obj.original_price || price;
          let mrp = -1;
          if (typeof mrpObj === 'number') mrp = mrpObj;
          else if (typeof mrpObj === 'string') mrp = parseFloat(mrpObj.replace(/[^0-9.]/g, ''));
          if (isNaN(mrp) || mrp < price) mrp = price;

          // Zepto sends prices in paise (e.g. 5000 = ₹50)
          if (price > 1000 && Number.isInteger(price)) {
            price = price / 100;
            mrp = mrp / 100;
          }

          if (!foundProductNames.has(name)) {
            foundProductNames.add(name);
            items.push({
              id: `${platformId}_api_${items.length}`,
              platformId,
              platformName: 'Zepto',
              platformType: 'QUICK_COMMERCE',
              rawTitle: name,
              brand: obj.brand || 'Unknown',
              variant: name,
              volumeMl: 0,
              weightGrams: 0,
              unitPriceNormalized: price,
              price,
              mrp,
              discountPercentage: Math.round(((mrp - price) / mrp) * 100) || 0,
              inStock: UniversalNormalizer.isInStock(obj),
              inStockQuantity: obj.inventory || obj.quantity || obj.availableQuantity || 10,
              productUrl: searchUrl,
              imageUrl: obj.image_url || obj.imageUrl || (obj.images && obj.images[0]) || '',
              fingerprint: UniversalNormalizer.generateFingerprint('Unknown', name, 0),
              confidenceScore: 0.95
            });
          }
        } else {
          for (const key in obj) {
            if (key !== 'parent' && key !== 'config') extractProductsRecursive(obj[key]);
          }
        }
      }
    }

    extractProductsRecursive(data);
    return items;
  }
}
