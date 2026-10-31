import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BasketModule } from '../basket/basket.module';
import { DatabaseModule } from '../database/database.module';
import { PlatformsModule } from '../platforms/platforms.module';
import { McpService } from './mcp.service';

/** Root module for the MCP process (npm run mcp): the same services as the web app, without HTTP. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // reads .env
    DatabaseModule,
    BasketModule,    // provides PriceFetcherService
    PlatformsModule, // provides PlatformsService
  ],
  providers: [McpService],
})
export class McpModule {}
