import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { LocationContext, ProductItem, ParsedItemQuery } from '../../types/commerce';
import { UniversalNormalizer } from '../universalNormalizer';

puppeteer.use(StealthPlugin());

export class BlinkitScraper {
  /**
   * Search for a product on Blinkit.
   */
  public async search(query: ParsedItemQuery, location?: LocationContext): Promise<ProductItem[]> {
    const queryStr = query.rawQuery;
    const searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(queryStr)}`;
    const apiKey = process.env.SCRAPER_API_KEY;

    let html = '';

    if (apiKey) {
      console.log(`[BlinkitScraper] 🌐 Routing request through ScraperAPI for: "${queryStr}"...`);
      try {
        const scraperApiUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(searchUrl)}&render=true&country_code=in`;
        const response = await axios.get(scraperApiUrl, { timeout: 45000 });
        html = response.data;
      } catch (err: any) {
        console.error(`[BlinkitScraper] ScraperAPI call failed: ${err.message}`);
        return [];
      }
    } else {
      console.log(`[BlinkitScraper] Launching browser for query: "${queryStr}"...`);
      let browser: any = null;

      try {
        browser = await puppeteer.launch({
          headless: true, // switch to 'new' or false if debugging
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });
        const page = await browser.newPage();
        
        // Set geolocation if provided
        if (location) {
          const context = browser.defaultBrowserContext();
          await context.overridePermissions('https://blinkit.com', ['geolocation']);
          await page.setGeolocation({ latitude: location.latitude, longitude: location.longitude });
        }

        // Optimize page load (allow stylesheets since they are needed for rendering and script checks)
        await page.setRequestInterception(true);
        page.on('request', (req: any) => {
          const resourceType = req.resourceType();
          if (['image', 'font', 'media'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });

        console.log(`[BlinkitScraper] Navigating to ${searchUrl}...`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Automatically bypass location select prompts by clicking geolocation buttons
        await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('button, div, span, p'));
          const btn = elements.find(el => {
            const txt = (el.textContent || '').trim().toLowerCase();
            return txt.includes('detect my location') || 
                   txt.includes('use current location') || 
                   txt.includes('detect location') || 
                   txt.includes('confirm location') ||
                   txt.includes('enable location');
          });
          if (btn) {
            (btn as HTMLElement).click();
            console.log('[BlinkitScraper] Clicked location detection button');
          }
        });

        // Wait a moment for dynamic content to render and geolocation to apply
        await new Promise(r => setTimeout(r, 4500));
        
        html = await page.content();
      } catch (err: any) {
        console.error(`[BlinkitScraper] Error scraping blinkit: ${err.message}`);
        return [];
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    }

    const $ = cheerio.load(html);
    const items: ProductItem[] = [];
    const platformId = 'blinkit';

    // Robust selector matching using class name prefixes
    $('[class*="ProductList__ProductContainer"], [class*="ProductCard"]').each((index, element) => {
      if (index >= 12) return; // limit candidate count

      const title = $(element).find('[class*="ProductDescription__ProductName"], [class*="ProductName"]').text().trim();
      const priceText = $(element).find('[class*="ProductPrice__Price"], [class*="Price"]').text().trim();
      const mrpText = $(element).find('[class*="ProductPrice__Mrp"], [class*="Mrp"]').text().trim();
      
      if (!title || !priceText) return;

      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
      const mrp = parseFloat(mrpText.replace(/[^0-9.]/g, '')) || price;
      
      items.push({
        id: `${platformId}_real_${index}`,
        platformId: platformId,
        platformName: 'Blinkit',
        platformType: 'QUICK_COMMERCE',
        rawTitle: title,
        brand: 'Unknown',
        variant: title,
        volumeMl: 0,
        weightGrams: 0,
        unitPriceNormalized: price, // Need real extraction
        price: price,
        mrp: mrp,
        discountPercentage: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
        inStock: true,
        inStockQuantity: 10,
        productUrl: searchUrl,
        imageUrl: '',
        fingerprint: UniversalNormalizer.generateFingerprint('Unknown', title, 0),
        confidenceScore: 0.90
      });
    });

    console.log(`[BlinkitScraper] Found ${items.length} items for "${queryStr}"`);
    return items;
  }
}
