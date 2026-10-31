/**
 * Session Capture Script
 * ---------------------
 * Run this script ONCE per platform to log in manually and save a persistent
 * authenticated session. The scraper will then reuse this session on every request.
 *
 * Usage:
 *   node scripts/capture-session.js zepto
 *   node scripts/capture-session.js instamart
 *   node scripts/capture-session.js blinkit
 *   node scripts/capture-session.js jiomart
 *
 * What to do:
 *   1. The script opens a visible browser window.
 *   2. Log in with your phone number + OTP manually.
 *   3. Set your delivery location.
 *   4. Search for any product to confirm results load.
 *   5. Press ENTER in the terminal to save the session.
 *
 * The session is saved to: sessions/<platform>.json
 * ⚠️  NEVER commit sessions/*.json to git — they contain auth cookies!
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

puppeteer.use(StealthPlugin());

const PLATFORM_URLS = {
  zepto:     'https://www.zeptonow.com',
  instamart: 'https://instamart.in',
  blinkit:   'https://blinkit.com',
  jiomart:   'https://www.jiomart.com',
  flipkart:  'https://www.flipkart.com',
  amazon:    'https://www.amazon.in',
  bigbasket: 'https://www.bigbasket.com'
};

const platform = process.argv[2];

if (!platform || !PLATFORM_URLS[platform]) {
  console.error(`❌ Usage: node scripts/capture-session.js <platform>`);
  console.error(`   Platforms: ${Object.keys(PLATFORM_URLS).join(', ')}`);
  process.exit(1);
}

const sessionPath = path.join(__dirname, '..', 'sessions', `${platform}.json`);
const startUrl = PLATFORM_URLS[platform];

(async () => {
  console.log(`\n🌐 Opening browser for: ${platform} (${startUrl})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  1. Log in with your phone number + OTP');
  console.log('  2. Set your delivery location / pincode');
  console.log('  3. Search for any product (e.g. "Milk")');
  console.log('  4. Confirm results are loading correctly');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  👉 Press ENTER in this terminal when ready to save.\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--start-maximized'
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );

  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for user to complete login manually
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve => rl.question('', resolve));
  rl.close();

  // Save session (cookies + localStorage)
  const cookies = await page.cookies();
  const localStorage = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      data[key] = window.localStorage.getItem(key);
    }
    return data;
  });

  const sessionData = { cookies, localStorage, platform, savedAt: new Date().toISOString() };
  fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));

  console.log(`\n✅ Session saved to: sessions/${platform}.json`);
  console.log(`   Cookies: ${cookies.length}`);
  console.log(`   localStorage keys: ${Object.keys(localStorage).length}`);

  await browser.close();
  process.exit(0);
})();
