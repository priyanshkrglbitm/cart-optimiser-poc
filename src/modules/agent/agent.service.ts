import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { LocationContext, UniversalBasketResponse } from '../../common/types/commerce.types';
import { LlmService } from '../llm/llm.service';
import { AGENT_TOOLS, AgentToolsService, ProductSearch } from './agent-tools.service';

const MAX_STEPS = 6; // model calls per user message; stops runaway loops

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** One tool call the agent made, shown in the UI under "How I got this". */
export interface AgentStep {
  tool: string;
  args: unknown;
  summary: string;
  ms: number;
}

export interface AgentReply {
  reply: string;
  options?: string[];               // tap-to-answer choices when the agent asked a question
  steps: AgentStep[];
  searches: ProductSearch[];        // top products from each search_products call, shown as tables
  basket?: UniversalBasketResponse; // full optimizer result, when optimize_basket ran
}

const systemPrompt = (location: LocationContext) => `You are SmartBasket, a grocery shopping assistant for Indian quick-commerce stores: Blinkit, Zepto, Swiggy Instamart, BigBasket BB Now, Flipkart Minutes and JioMart Quick. The user's delivery pincode is ${location.pincode}.

Rules:
1. Never guess prices, totals, fees or which store is cheaper. Always get them from the tools and repeat the numbers exactly.
2. For items without a brand (e.g. "atta", "butter 100g"), call search_products for each one. Then call ask_user ONCE for the whole list, never one question per item: offer "Best value for all" first, then a few specific choices. The user already sees the full top-10 tables, so don't repeat them. Skip asking if the user said to choose for them.
3. If search_products finds nothing for an item, try at most one other name. If that also finds nothing, tell the user it isn't available and carry on without it.
4. Keep the user's sizes and counts in the list (5 kg atta, 1 dozen eggs = 12 eggs, 100 g butter).
5. Once every item is clear, call optimize_basket with the whole list. When the user answers "Best value for all", call optimize_basket straight away (no new searches) with the plain item names and sizes from their list, e.g. "atta 5kg", "12 eggs"; leave out items you already found unavailable. Then say which store is cheapest, its total including fees, and whether splitting across stores saves money and how.
6. Understand Hinglish (doodh = milk, atta/aata = wheat flour, dahi = curd, anda = eggs, pyaz = onion, aloo = potato).
7. Reply in short plain text. No markdown tables or headings; numbered lines are fine. Use ₹.`;

/**
 * The shopping agent: the model decides which tool to call next (search, optimize, ask the user), our code runs
 * the tool, and the result goes back to the model, until it answers or asks a question. All maths stays in the tools.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly tools: AgentToolsService,
  ) {}

  async chat(history: ChatMessage[], location: LocationContext): Promise<AgentReply> {
    const steps: AgentStep[] = [];
    const searches: ProductSearch[] = [];
    let basket: UniversalBasketResponse | undefined;
    const done = (reply: string, options?: string[]): AgentReply => ({ reply, options, steps, searches, basket });

    if (!this.llm.isEnabled) {
      return done('The AI assistant needs GROQ_API_KEY in .env. You can still use Compare prices.');
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt(location) },
      ...history.map(m => ({ role: m.role, content: m.content })),
    ];
    const started = Date.now();
    this.logger.log(`Start: "${history[history.length - 1]?.content}" (${history.length} messages, pincode ${location.pincode})`);

    for (let step = 1; step <= MAX_STEPS; step++) {
      let message: OpenAI.Chat.ChatCompletionMessage | null;
      try {
        message = await this.llm.chat(messages, AGENT_TOOLS);
      } catch (err: any) {
        return done(friendlyError(err));
      }
      if (!message) return done('The AI model is not responding right now. Please try again in a moment.');

      const calls = (message.tool_calls ?? []).filter(c => c.type === 'function');
      if (calls.length === 0) {
        this.logger.log(`Done in ${Date.now() - started}ms after ${steps.length} tool call(s)`);
        return done(cleanReply(message.content));
      }

      // Asking the user ends this turn; their answer arrives as the next chat message.
      // If the model asks several questions at once, show them together.
      const questions = calls.filter(c => c.function.name === 'ask_user').map(c => parseArgs(c.function.arguments));
      if (questions.length) {
        const question = questions.map(q => String(q.question ?? '')).filter(Boolean).join('\n');
        const options = [...new Set(questions.flatMap(q => (Array.isArray(q.options) ? q.options.map(String) : [])))].slice(0, 6);
        this.logger.log(`Asks user: "${question}" (${Date.now() - started}ms)`);
        return done(question, options.length ? options : undefined);
      }

      messages.push(message);
      for (const call of calls) {
        const name = call.function.name;
        const args = parseArgs(call.function.arguments);

        const toolStart = Date.now();
        const result = await this.tools.run(name, args, location);
        const ms = Date.now() - toolStart;
        this.logger.log(`Step ${step}: ${name}(${JSON.stringify(args)}) → ${result.summary} (${ms}ms)`);
        steps.push({ tool: name, args, summary: result.summary, ms });
        if (result.basket) basket = result.basket;
        if (result.search) searches.push(result.search);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result.data) });
      }
    }

    this.logger.warn(`Stopped after ${MAX_STEPS} model calls`);
    return done("I couldn't finish that in time. Try asking for fewer things at once.");
  }
}

/** Turns API errors into something the user can act on. */
function friendlyError(err: any): string {
  if (err?.status === 429) {
    const wait = /try again in ([\d.]+)s/i.exec(String(err.message))?.[1];
    return `The free AI tier is busy (too many requests this minute). Please try again${wait ? ` in about ${Math.ceil(Number(wait))} seconds` : ' shortly'}.`;
  }
  return 'The AI model is not responding right now. Please try again in a moment.';
}

function parseArgs(json: string): any {
  try {
    return JSON.parse(json || '{}');
  } catch {
    return {};
  }
}

/** Removes any <think>…</think> reasoning some models add before the answer. */
function cleanReply(content: string | null): string {
  return (content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 'Done.';
}
