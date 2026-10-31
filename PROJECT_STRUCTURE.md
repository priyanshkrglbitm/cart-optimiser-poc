# Project Structure

Basket optimizer: takes a grocery list, looks up prices on quick-commerce stores, and finds the cheapest single store or the cheapest split across stores, including every store fee.

Built with **NestJS** (modules, controllers, services, DTOs), the same pattern as the Carpool backend.

> **Prices come from a local sample database.** Product and brand names are real Indian market items, but prices, ratings, reviews and fees are **generated** for the demo. They are not real store prices. A real price source (partner or data-provider API) can replace the database later behind `PlatformsService`.

## How a request flows

```
POST /api/basket/optimize  { items: ["amul butter 500g", "doodh 1L"], location: { ..., pincode } }
  → BasketController        checks the body with OptimizeBasketDto (pincode required)
  → BasketService           90s cache, then runs the pipeline:
      → QueryParserService      text → brand / item / size / count (rules + Groq LLM)
      → PriceFetcherService     looks up each item at every store
          → PlatformsService        searches the price database
      → BasketOptimizerService  best total per store + best split (items + all fees)
      → LlmService              2-line AI summary
  ← JSON result to the dashboard
```

## Modules

```
AppModule
 ├─ ConfigModule (global, reads .env)
 ├─ DatabaseModule (global) ── DatabaseService: SQLite price database
 ├─ ServeStaticModule ── serves public/ (the dashboard)
 └─ BasketModule ── controller + 4 services
     ├─ LlmModule ──────── LlmService
     └─ PlatformsModule ── PlatformsService
```

## Database (`data/basket.db`, SQLite built into Node)

| Table | What it holds |
|---|---|
| `platforms` | The 6 stores and their fees: delivery fee and free-delivery threshold, handling fee, platform fee, small-cart fee and threshold |
| `products` | ~1,000 products: name, brand, category, product type, variant, size, MRP, search keywords (incl. Hinglish) |
| `listings` | One row per product per store: price, MRP, in stock, rating, review count |
| `meta` | `data_source = synthetic`, when it was generated, and the seed |

The database is created and filled automatically on first start. `npm run db:seed` regenerates it.

## Folders and files

### Root

| File | What it does |
|---|---|
| `DEVELOPER_GUIDE.md` | How the app works, one flow per section (starting with the search flow) |
| `PROJECT_STRUCTURE.md` | This file: what every folder and file contains |
| `package.json` | Dependencies and npm scripts (`start`, `start:dev`, `build`, `start:prod`, `cli`, `mcp`, `db:seed`) |
| `nest-cli.json` | Nest CLI settings (source folder, clean `dist/` on build) |
| `tsconfig.json` | TypeScript settings, including decorators for Nest |
| `.env.example` | Settings template. Copy it to `.env` and add `GROQ_API_KEY` |
| `.env` | Your real settings and API key. Ignored by git, never commit it |
| `data/` | The generated SQLite database. Ignored by git; recreated on start |
| `logs/` | Log files from Winston: `app-YYYY-MM-DD.log` (everything, kept 14 days) and `error-YYYY-MM-DD.log` (errors only, kept 30 days). Ignored by git |

### `src/` – entry points

| File | What it does |
|---|---|
| `main.ts` | Starts the Nest app: Winston logger, global `/api` route prefix, body validation, request logging; listens on `PORT` (default 3079) |
| `logger.config.ts` | Winston logger, same setup as ets-backend: coloured console plus daily rotating files in `logs/`. Line format: `time # level # service # message`. Detail level from `LOG_LEVEL` |
| `app.module.ts` | Root module: `ConfigModule` (`.env`), `DatabaseModule`, `ServeStaticModule` (serves the dashboard from `public/`, except `/api/*`), `BasketModule` |
| `mcp.ts` | Entry point for `npm run mcp`: starts `McpModule` without HTTP and runs `McpService` |
| `cli.ts` | Runs one basket from the terminal (`npm run cli -- milk butter`). Starts Nest without the HTTP server and uses `BasketService` |

### `src/modules/basket/` – the main feature

| File | What it does |
|---|---|
| `basket.module.ts` | Wires the controller and services below; imports `LlmModule` and `PlatformsModule` |
| `basket.controller.ts` | **API entry point.** `@Controller('basket')` + `@Post('optimize')` → `POST /api/basket/optimize`. Takes the validated `OptimizeBasketDto` and calls `BasketService` |
| `dto/optimize-basket.dto.ts` | Request rules: 1–30 items, each up to 100 characters; location with valid latitude/longitude and a 6-digit pincode. Unknown fields are rejected |
| `basket.service.ts` | Runs the pipeline: parse → fetch → optimize → AI summary. Caches results for 90 seconds and merges identical requests that arrive together |
| `query-parser.service.ts` | Turns the raw list into structured items. Rules always run, then one Groq call for the whole list improves brand, item name (including Hinglish: doodh → Milk), size and count ("12 eggs"). Cached per item |
| `price-fetcher.service.ts` | For one item, asks every store for matching products and sorts them: requested brand first, then cheapest |
| `basket-optimizer.service.ts` | `calculatePlatformSummaries()`: cheapest way to buy the whole list at each store (requested brand preferred), plus that store's fees. `calculateSplitCart()`: tries every combination of stores and picks the cheapest total including each store's fees. `fees()`: delivery, handling, platform and small-cart fee for one order. Also works out how many packs to buy (1kg asked, 500g pack → 2) |

### `src/modules/database/` – the price database

| File | What it does |
|---|---|
| `database.module.ts` | Global module that provides `DatabaseService` |
| `database.service.ts` | Opens `data/basket.db` (`DB_PATH`), creates the tables, and fills them with sample data when empty. `reset()` regenerates everything |
| `seed/catalog-spec.ts` | What products exist: categories, product types, search keywords, real brands, variants, pack sizes and a typical price per g/ml/piece |
| `seed/platforms-spec.ts` | The 6 stores with sample fees and how each one prices (average discount, share of catalog carried) |
| `seed/seed-catalog.ts` | Generates products (brand × variant × size) with realistic MRPs, then a price, stock, rating and review count per store. Same seed → same data. Prices never exceed MRP |
| `seed/run-seed.ts` | `npm run db:seed -- --count 1000 --seed 42` regenerates the database |

### `src/modules/platforms/` – the stores

| File | What it does |
|---|---|
| `platforms.module.ts` | Provides and exports `PlatformsService` |
| `platforms.service.ts` | Reads stores and their fees from the database. `search()` finds one list item at one store: first as an exact product type or keyword ("butter", "doodh"), then by every word in the product name, so "milk" doesn't return milk chocolate |

### `src/modules/llm/` – the AI model

| File | What it does |
|---|---|
| `llm.module.ts` | Provides and exports `LlmService` |
| `llm.service.ts` | The one LLM client (OpenAI SDK pointed at Groq, default model `qwen/qwen3.8-27b`). `askText()` and `askJson()` return `null` on failure so the app keeps working without the LLM. Switch provider or model with `LLM_BASE_URL` / `LLM_MODEL` in `.env` |

### `src/common/` – shared code

| File | What it does |
|---|---|
| `types/commerce.types.ts` | Shared data shapes: parsed item, product (with rating), store info and fees, fee breakdown, search result, store summary, split recommendation, API response |
| `interceptors/request-logging.interceptor.ts` | Logs every API call: method, path, status, time taken, and the reason when a request is rejected |
| `utils/normalizer.ts` | Rule helpers: brand detection (brands from the catalog), size extraction ("5kg" → 5000g), piece counts ("12 eggs", "pack of 6"), cleaning the item name |

### `src/modules/mcp/` – MCP server (for AI assistants)

| File | What it does |
|---|---|
| `mcp.module.ts` | Root module for the MCP process: config, database, `BasketModule`, `PlatformsModule`, and `McpService` |
| `mcp.service.ts` | `@Injectable()` MCP server, so an AI assistant can call the price search as tools: `fetch_prices_across_platforms`, `search_blinkit`, `search_zepto`, `search_instamart`. Gets `PriceFetcherService` and `PlatformsService` by injection |

### `public/` – the web dashboard (plain HTML, CSS and JS, no build step)

| File | What it does |
|---|---|
| `index.html` | Page layout only: top bar, left panel (location, pincode, basket), right side for results |
| `css/styles.css` | All styles. Section 1 holds the light and dark colors; the rest is grouped by page part |
| `js/app.js` | Start here. Connects the parts and runs the "Compare prices" button |
| `js/basket.js` | The shopping list: add, remove, quick presets |
| `js/location.js` | Map (Google tiles), address search, "use my location", and the pincode filled in from the map. Default: Gopalpatti, Pune (412307) |
| `js/api.js` | Calls `POST /api/basket/optimize` with a 90-second timeout |
| `js/results.js` | Draws the results: sample-data notice, best store vs cheapest split, AI summary, a card per store with fee breakdown and ratings (switch products and the total and fees update), split plan grouped by store |
| `js/theme.js` | Light/dark toggle; follows the system setting until you pick one |
| `js/utils.js` | `escapeHtml()` (data is never inserted as raw HTML) and `rupees()` formatting |

## Common commands

```bash
npm install                 # install dependencies
npm run start:dev           # dashboard at http://127.0.0.1:3079, restarts on changes
npm run db:seed             # regenerate the sample price database
npm run build && npm run start:prod   # production build and run
npm run cli -- milk "amul butter 500g"
```
