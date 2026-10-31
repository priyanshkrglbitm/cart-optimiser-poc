import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { PlatformsModule } from '../platforms/platforms.module';
import { BasketController } from './basket.controller';
import { BasketService } from './basket.service';
import { QueryParserService } from './query-parser.service';
import { PriceFetcherService } from './price-fetcher.service';
import { BasketOptimizerService } from './basket-optimizer.service';

@Module({
  imports: [LlmModule, PlatformsModule],
  controllers: [BasketController],
  providers: [BasketService, QueryParserService, PriceFetcherService, BasketOptimizerService],
  exports: [BasketService, PriceFetcherService],
})
export class BasketModule {}
