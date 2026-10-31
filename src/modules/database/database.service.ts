import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, resolve } from 'path';
import { seedCatalog, SeedOptions } from './seed/seed-catalog';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS platforms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    eta TEXT NOT NULL,
    delivery_fee REAL NOT NULL,
    free_delivery_above REAL NOT NULL,
    handling_fee REAL NOT NULL,
    platform_fee REAL NOT NULL,
    small_cart_fee REAL NOT NULL,
    small_cart_below REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,          -- "Amul Salted Butter"
    brand TEXT NOT NULL,
    category TEXT NOT NULL,      -- "Dairy & Eggs"
    subcategory TEXT NOT NULL,   -- "Butter"
    variant TEXT NOT NULL,
    size_value REAL NOT NULL,    -- 500
    size_unit TEXT NOT NULL,     -- g | ml | pc
    mrp REAL NOT NULL,
    keywords TEXT NOT NULL,      -- "|butter|makhan|" for exact phrase matching
    search_text TEXT NOT NULL    -- lowercase name + category + keywords for word matching
  );

  -- One row per product per store: that store's price, stock and rating
  CREATE TABLE IF NOT EXISTS listings (
    product_id INTEGER NOT NULL REFERENCES products(id),
    platform_id TEXT NOT NULL REFERENCES platforms(id),
    price REAL NOT NULL,
    mrp REAL NOT NULL,
    in_stock INTEGER NOT NULL,
    rating REAL NOT NULL,
    review_count INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (product_id, platform_id)
  );
  CREATE INDEX IF NOT EXISTS listings_by_platform ON listings(platform_id);

  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

/** The price database (SQLite file, built into Node). Creates the tables and fills them with sample data on first run. */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly db: DatabaseSync;

  constructor(config: ConfigService) {
    const path = resolve(config.get<string>('DB_PATH') || 'data/basket.db');
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec(SCHEMA);
  }

  onModuleInit() {
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number };
    if (n === 0) this.reset();
    else this.logger.log(`Price database ready: ${n} products (sample data)`);
  }

  onModuleDestroy() {
    this.db.close();
  }

  /** Deletes all data and generates a fresh sample catalog. */
  reset(options: SeedOptions = {}) {
    this.db.exec('DELETE FROM listings; DELETE FROM products; DELETE FROM platforms; DELETE FROM meta;');
    const result = seedCatalog(this.db, options);
    this.logger.log(`Generated sample data: ${result.products} products, ${result.listings} store prices (${result.combinationsAvailable} combinations available)`);
    return result;
  }
}
