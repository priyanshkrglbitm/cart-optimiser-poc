# Project Structure

Basket optimizer: takes a grocery list, gets prices from quick-commerce stores, and finds the cheapest single store or the cheapest split across stores.

Built with **NestJS** (modules, controllers, services, DTOs), the same pattern as the Carpool backend.

## How a request flows

```
POST /api/optimize-basket  { items: ["amul butter 500g", "doodh 1L"], location: {...} }
  → BasketController        checks the body with OptimizeBasketDto
  → BasketService           90s cache, then runs the pipeline:
      → QueryParserService      text → brand / item / size (rules + Groq LLM)
      → PriceFetcherService     searches every store for each item
          → PlatformsService        runs each store's scraper (45s timeout per store)
      → BasketOptimizerService  best total per store + best split (with delivery fees)
      → LlmService              2-line AI summary
  ← JSON result to the dashboard
```

## Modules

```
AppModule
 ├─ ConfigModule (global, reads .env)
 └─ BasketModule ── controller + 4 services
     ├─ LlmModule ──────── LlmService
     └─ PlatformsModule ── PlatformsService + scrapers
```

## Folders and files

### Root

| File | What it does |
|---|---|
| `package.json` | Dependencies and npm scripts (`start`, `start:dev`, `build`, `start:prod`, `cli`, `mcp`, `session:<store>`) |
| `nest-cli.json` | Nest CLI settings (source folder, clean `dist/` on build) |
| `tsconfig.json` | TypeScript settings, including decorators for Nest |
| `.env.example` | Settings template. Copy it to `.env` and add `GROQ_API_KEY` |
| `.env` | Your real settings and API key. Ignored by git, never commit it |

### `src/` – entry points

| File | What it does |
|---|---|
| `main.ts` | Starts the Nest app: validation for request bodies, serves the dashboard from `public/`, listens on `PORT` (default 3000) |
| `app.module.ts` | Root module: loads `.env` through `ConfigModule` and imports `BasketModule` |
| `cli.ts` | Runs one basket from the terminal (`npm run cli -- milk butter`). Starts Nest without the HTTP server and uses `BasketService` |

### `src/modules/basket/` – the main feature

| File | What it does |
|---|---|
| `basket.module.ts` | Wires the controller and services below; imports `LlmModule` and `PlatformsModule` |
| `basket.controller.ts` | `POST /api/optimize-basket`. Takes the validated body and calls `BasketService` |
| `dto/optimize-basket.dto.ts` | Request rules: 1–30 items, each up to 100 characters; optional location with valid latitude/longitude. Unknown fields are rejected |
| `basket.service.ts` | Runs the pipeline: parse → fetch → optimize → AI summary. Caches results for 90 seconds and merges identical requests that arrive together |
| `query-parser.service.ts` | Turns the raw list into structured items. Rules always run, then one Groq call for the whole list improves brand, item name (including Hinglish: doodh → Milk) and size. Cached per item |
| `price-fetcher.service.ts` | For one item, searches all stores in parallel. Searches by generic item + size so other brands show up, then sorts: requested brand first, then cheapest |
| `basket-optimizer.service.ts` | `calculatePlatformSummaries()`: cheapest way to buy the whole list at each store, plus delivery fee. `calculateSplitCart()`: tries every combination of stores and picks the cheapest total including each store's delivery fee. Also works out how many packs to buy (1kg asked, 500g pack → 2) |

### `src/modules/llm/` – the AI model

| File | What it does |
|---|---|
| `llm.module.ts` | Provides and exports `LlmService` |
| `llm.service.ts` | The one LLM client (OpenAI SDK pointed at Groq, default model `qwen/qwen3.8-27b`). `askText()` and `askJson()` return `null` on failure so the app keeps working without the LLM. Switch provider or model with `LLM_BASE_URL` / `LLM_MODEL` in `.env` |

### `src/modules/platforms/` – the stores

| File | What it does |
|---|---|
| `platforms.module.ts` | Provides and exports `PlatformsService` |
| `platforms.service.ts` | The table of every store (name, delivery time, delivery fee, free-delivery threshold, scraper). `search()` runs one store's scraper with a timeout (`STORE_TIMEOUT_MS`, default 45s); a crash or timeout marks that store `ERROR` without failing the basket. To add a store: write a scraper and add one row |
| `scrapers/blinkitScraper.ts` | Blinkit search page. Reads the JSON the page loads |
| `scrapers/zeptoScraper.ts` | Zepto. Calls Zepto's search API directly if a saved login exists, otherwise reads the search page |
| `scrapers/instamartScraper.ts` | Swiggy Instamart search page. Reads the JSON it loads, falls back to product cards in the HTML |
| `scrapers/bigBasketScraper.ts` | BigBasket search page, same approach |
| `scrapers/jioMartScraper.ts` | JioMart search page, same approach |
| `scrapers/flipkartMinutesScraper.ts` | Flipkart Minutes search page, same approach |
| `scrapers/amazonFreshScraper.ts` | Amazon Fresh search page, same approach |

All scrapers work the same way: open a hidden Chrome window (Puppeteer), set the user's location, load the store's search page, record the JSON it loads, and treat anything with a name and a price as a product. A blocked store returns no results; it never makes up prices.

> **Known limits:** the stores' bot protection often blocks these scrapers, the "name + price" rule is a guess, and paise vs rupees is guessed. For reliable prices, use an official API (e.g. Swiggy's MCP for Instamart), a paid price-data provider, or a partner API.

### `src/common/` – shared code

| File | What it does |
|---|---|
| `types/commerce.types.ts` | Shared data shapes: parsed item, product, store info, search result, store summary, split recommendation, API response |
| `utils/normalizer.ts` | Rule helpers: known-brand detection, size extraction ("5kg" → 5000g), piece counts ("pack of 6"), cleaning the item name, product fingerprint, `isInStock()` |

### `src/mcp/`

| File | What it does |
|---|---|
| `mcp-server.ts` | MCP server, so an AI assistant can call the price search as tools: `fetch_prices_across_platforms`, `search_blinkit`, `search_zepto`, `search_instamart` (`npm run mcp`). Starts Nest without the HTTP server and uses the same services |

### `public/` – the web dashboard (plain HTML, CSS and JS, no build step)

| File | What it does |
|---|---|
| `index.html` | Page layout only: top bar, left panel (location + basket), right side for results |
| `css/styles.css` | All styles. Section 1 holds the light and dark colors; the rest is grouped by page part |
| `js/app.js` | Start here. Connects the parts and runs the "Compare prices" button |
| `js/basket.js` | The shopping list: add, remove, quick presets |
| `js/location.js` | Map (Google tiles), address search, "use my location". Default: Gopalpatti, Pune |
| `js/api.js` | Calls `POST /api/optimize-basket` with a 90-second timeout |
| `js/results.js` | Draws the results: best store vs cheapest split, AI summary, a card per store (switch products and the total updates), split plan grouped by store |
| `js/theme.js` | Light/dark toggle; follows the system setting until you pick one |
| `js/utils.js` | `escapeHtml()` (store data is never inserted as raw HTML) and `rupees()` formatting |

### `scripts/`

| File | What it does |
|---|---|
| `capture-session.js` | Opens a visible browser so you can log in to a store yourself, then saves its cookies to `sessions/<store>.json` (`npm run session:zepto`) |

### `sessions/`

Saved store logins from `capture-session.js`. They contain login cookies and are ignored by git.

## Common commands

```bash
npm install                 # install dependencies
npm run start:dev           # dashboard at http://127.0.0.1:3000, restarts on changes
npm run build && npm run start:prod   # production build and run
npm run cli -- milk "amul butter 500g"
```
