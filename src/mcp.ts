import { NestFactory } from '@nestjs/core';
import { McpModule } from './modules/mcp/mcp.module';
import { McpService } from './modules/mcp/mcp.service';

// Entry point for the MCP server: npm run mcp
// Nest without HTTP (a standalone application); logger off because stdout carries the MCP protocol.
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(McpModule, { logger: false });
  await app.get(McpService).start();
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
