import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AgentReply, AgentService } from './agent.service';
import { AgentChatDto } from './dto/agent-chat.dto';

/** API entry point for the shopping agent. */
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /** POST /api/agent/chat  { messages: [{ role, content }], location: { latitude, longitude, pincode } } */
  @Post('chat')
  @HttpCode(200)
  chat(@Body() dto: AgentChatDto): Promise<AgentReply> {
    return this.agentService.chat(dto.messages, dto.location);
  }
}
