import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PriceFetcher } from '../core/priceFetcher';
import { UniversalNormalizer } from '../core/normalizer';
import { PLATFORMS, searchPlatform } from '../platforms';
import { LocationContext } from '../types';

export class CommerceMcpServer {
  private server: Server;
  private priceFetcher: PriceFetcher;

  constructor() {
    this.priceFetcher = new PriceFetcher();
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
                latitude: { type: 'number', description: 'User latitude (e.g. 12.9716)' },
                longitude: { type: 'number', description: 'User longitude (e.g. 77.5946)' }
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
                longitude: { type: 'number' }
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
                longitude: { type: 'number' }
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
                longitude: { type: 'number' }
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
      const lat = (args as any)?.latitude ?? 12.9716;
      const lng = (args as any)?.longitude ?? 77.5946;

      const location: LocationContext = { latitude: lat, longitude: lng };
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

      const platform = PLATFORMS.find(p => p.metadata.id === name.replace('search_', ''));
      if (!platform) {
        throw new Error(`Unknown MCP Tool: ${name}`);
      }

      const result = await searchPlatform(platform, parsedQuery, location);

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
    console.log('📡 Universal Commerce MCP Server running on stdio transport.');
  }
}

if (require.main === module) {
  const mcpServer = new CommerceMcpServer();
  mcpServer.start().catch(console.error);
}

