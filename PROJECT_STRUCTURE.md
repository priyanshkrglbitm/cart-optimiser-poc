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
 └─ AgentModule ── AgentController + AgentService (tool loop) + AgentToolsService
     (imports LlmModule, BasketModule)
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

### `src/modules/agent/` – the AI shopping assistant

| File | What it does |
|---|---|
| `agent.module.ts` | Wires the agent: imports `LlmModule` and `BasketModule` |
| `agent.controller.ts` | **API entry point for the chat.** `@Controller('agent')` + `@Post('chat')` → `POST /api/agent/chat` with `AgentChatDto` |
| `dto/agent-chat.dto.ts` | Request rules: 1–20 messages (user/assistant, ≤ 2000 characters) and a location with a 6-digit pincode |
| `agent.service.ts` | The tool-calling loop: sends the conversation and tools to the model, runs the tools it asks for, feeds results back, until it answers or asks you a question. System prompt with the agent's rules. Max 6 model calls; friendly message on Groq rate limits |
| `agent-tools.service.ts` | The tools: `search_products` (top 10 by value, rating and reviews), `optimize_basket` (the full optimizer), and the `ask_user` definition. All prices and maths come from here, never from the model |

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md#agent-flow) for the step-by-step flow.

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
| `platforms.module.ts` | Provides and exports `PlatformsService`; registers `PlatformsController` |
| `platforms.controller.ts` | `GET /api/platforms`: every store with delivery time and fees (the dashboard's store list and KPI cards) |
| `platforms.service.ts` | Reads stores and their fees from the database. `search()` finds one list item at one store: first as an exact product type or keyword ("butter", "doodh"), then by every word in the product name, so "milk" doesn't return milk chocolate |

### `src/modules/llm/` – the AI model

| File | What it does |
|---|---|
| `llm.module.ts` | Provides and exports `LlmService` |
| `llm.service.ts` | The one LLM client (OpenAI SDK pointed at Groq, default model `qwen/qwen3.8-27b`). `askText()` and `askJson()` return `null` on failure so the app keeps working without the LLM; `chat()` does one tool-calling step for the agent. Switch provider or model with `LLM_BASE_URL` / `LLM_MODEL` in `.env` |

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
| `index.html` | Page layout only: SVG icon sprite, sidebar (with "Soon" sections), top bar (search, location pill, notifications, profile), KPI cards, smart basket, results, assistant, store list, location dialog |
| `css/styles.css` | The design system: tokens (light and dark), app shell, controls, dashboard, basket, assistant, stores, results, dialog, responsive rules |
| `js/app.js` | Start here. Connects the parts and runs the "Compare prices" button |
| `js/shell.js` | The app frame: mobile sidebar, notifications and profile menus, ⌘K search shortcut, top-bar search sent to the assistant, active sidebar link |
| `js/kpis.js` | KPI cards and the "Stores in your area" list (from `GET /api/platforms`); best total and saving update on every result |
| `js/agent.js` | The shopping assistant chat: message bubbles, top-10 tables, tap-to-answer options, "How I got this" steps; draws the agent's price comparison with `results.js` |
| `js/basket.js` | The shopping list: add, remove, quick presets |
| `js/location.js` | Location dialog: map (Google tiles), address search, "use my location", pincode filled in from the map, and the top-bar location pill. Default: Gopalpatti, Pune (412307) |
| `js/api.js` | Calls the API with a 90-second timeout: `optimizeBasket()` → `POST /api/basket/optimize`, `agentChat()` → `POST /api/agent/chat` |
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
