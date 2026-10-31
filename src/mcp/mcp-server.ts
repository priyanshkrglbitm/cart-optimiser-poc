import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UniversalNormalizer } from '../common/utils/normalizer';
import { LocationContext } from '../common/types/commerce.types';
import { PriceFetcherService } from '../modules/basket/price-fetcher.service';
import { PlatformsService } from '../modules/platforms/platforms.service';

export class CommerceMcpServer {
  private server: Server;

  constructor(
    private readonly priceFetcher: PriceFetcherService,
    private readonly platformsService: PlatformsService,
  ) {
    this.server = new Server(
      {
        name: 'universal-commerce-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available MCP tools for AI models
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'fetch_prices_across_platforms',
            description: 'Fetch multi-variant prices, MRP, stock levels, and darkstore availability for an item across all platforms given lat/long.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Product item query (e.g., Milk, Toor Dal, Butter)' },
                latitude: { type: 'number', description: 'User latitude (e.g. 18.508885)' },
                longitude: { type: 'number', description: 'User longitude (e.g. 73.956373)' },
                pincode: { type: 'string', description: '6-digit delivery pincode (e.g. 412307)' }
              },
              required: ['query']
            }
          },
          {
            name: 'search_blinkit',
            description: 'Search product prices and availability on Blinkit (10-15 min quick commerce).',
            inputSchema: {
              type: 'object',
              properties: { 
                query: { type: 'string', description: 'Product search query' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                pincode: { type: 'string', description: '6-digit delivery pincode (e.g. 412307)' }
              },
              required: ['query']
            }
          },
          {
            name: 'search_zepto',
            description: 'Search product prices and availability on Zepto (10 min quick commerce).',
            inputSchema: {
              type: 'object',
              properties: { 
                query: { type: 'string', description: 'Product search query' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                pincode: { type: 'string', description: '6-digit delivery pincode (e.g. 412307)' }
              },
              required: ['query']
            }
          },
          {
            name: 'search_instamart',
            description: 'Search product prices and availability on Swiggy Instamart.',
            inputSchema: {
              type: 'object',
              properties: { 
                query: { type: 'string', description: 'Product search query' },
                latitude: { type: 'number' },
                longitude: { type: 'number' },
                pincode: { type: 'string', description: '6-digit delivery pincode (e.g. 412307)' }
              },
              required: ['query']
            }
          }
        ]
      };
    });

    // Execute MCP Tool Calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const queryStr = (args as any)?.query || '';
      const lat = (args as any)?.latitude ?? 18.508885;
      const lng = (args as any)?.longitude ?? 73.956373;

      const location: LocationContext = { latitude: lat, longitude: lng, pincode: (args as any)?.pincode ?? '412307' };
      const parsedQuery = UniversalNormalizer.parseQuery(queryStr);
      parsedQuery.location = location;

      if (name === 'fetch_prices_across_platforms') {
        const results = await this.priceFetcher.fetchPrices(parsedQuery, location);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }

      const platform = this.platformsService.findById(name.replace('search_', ''));
      if (!platform) {
        throw new Error(`Unknown MCP Tool: ${name}`);
      }

      const result = await this.platformsService.search(platform, parsedQuery, location);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    });
  }

  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('📡 Universal Commerce MCP Server running on stdio transport.'); // stdout is reserved for MCP messages
  }
}

async function main() {
  // Nest app without the HTTP server; logger off because stdout carries the MCP protocol
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  await new CommerceMcpServer(app.get(PriceFetcherService), app.get(PlatformsService)).start();
}

if (require.main === module) {
  main().catch(console.error);
}

