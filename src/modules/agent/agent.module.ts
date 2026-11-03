import { Module } from '@nestjs/common';
import { BasketModule } from '../basket/basket.module';
import { LlmModule } from '../llm/llm.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentToolsService } from './agent-tools.service';

@Module({
  imports: [LlmModule, BasketModule], // BasketModule exports BasketService and PriceFetcherService
  controllers: [AgentController],
  providers: [AgentService, AgentToolsService],
})
export class AgentModule {}
