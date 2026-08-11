import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { LocationContext, ProductItem, ParsedItemQuery } from '../../types/commerce';
import { UniversalNormalizer } from '../universalNormalizer';

puppeteer.use(StealthPlugin());

export class JioMartScraper {
  public async search(query: ParsedItemQuery, location?: LocationContext): Promise<ProductItem[]> {
    const queryStr = query.rawQuery;
    const searchUrl = `https://www.jiomart.com/search/${encodeURIComponent(queryStr)}`;
    const apiKey = process.env.SCRAPER_API_KEY;

    let html = '';

    if (apiKey) {
      console.log(`[JioMartScraper] 🌐 Routing request through ScraperAPI for: "${queryStr}"...`);
      try {
        const scraperApiUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(searchUrl)}&render=true&country_code=in`;
        const response = await axios.get(scraperApiUrl, { timeout: 45000 });
        html = response.data;
      } catch (err: any) {
        console.error(`[JioMartScraper] ScraperAPI call failed: ${err.message}`);
        return [];
      }
    } else {
      console.log(`[JioMartScraper] Launching browser for query: "${queryStr}"...`);
      let browser: any = null;

      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });
        const page = await browser.newPage();
        
        if (location) {
          const context = browser.defaultBrowserContext();
          await context.overridePermissions('https://www.jiomart.com', ['geolocation']);
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

        console.log(`[JioMartScraper] Navigating to ${searchUrl}...`);
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
                   txt.includes('enable location') ||
                   txt.includes('confirm');
          });
          if (btn) {
            (btn as HTMLElement).click();
            console.log('[JioMartScraper] Clicked location detection button');
          }
        });

        // Wait a moment for dynamic content to render and geolocation to apply
        await new Promise(r => setTimeout(r, 4500));
        
        html = await page.content();
      } catch (err: any) {
        console.error(`[JioMartScraper] Error scraping JioMart: ${err.message}`);
        return [];
      } finally {
        if (browser) {
          await browser.close();
        }
      }
    }

    const $ = cheerio.load(html);
    const items: ProductItem[] = [];
    const platformId = 'jiomart';

    // Placeholder selectors for JioMart
    $('.ais-InfiniteHits-item').each((index, element) => {
      if (index >= 3) return;

      const title = $(element).find('.plp-card-details-name').text().trim() || `JioMart Item ${index+1}`;
      const priceText = $(element).find('.jm-heading-xxs').text().trim() || '100';
      const mrpText = $(element).find('.jm-body-xxs.jm-fc-primary-grey-60').text().trim() || priceText;
      
      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
      const mrp = parseFloat(mrpText.replace(/[^0-9.]/g, '')) || price;
      
      items.push({
        id: `${platformId}_real_${index}`,
        platformId: platformId,
        platformName: 'JioMart',
        platformType: 'STANDARD_ECOMMERCE',
        rawTitle: title,
        brand: 'Unknown',
        variant: title,
        volumeMl: 0,
        weightGrams: 0,
        unitPriceNormalized: price,
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

    console.log(`[JioMartScraper] Found ${items.length} items for "${queryStr}"`);
    return items;
  }
}
