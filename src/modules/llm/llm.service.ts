import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * The one LLM client. Groq speaks the OpenAI API, so the official SDK works by pointing it at Groq's URL.
 * Any OpenAI-compatible provider works: change LLM_BASE_URL and LLM_MODEL in .env.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('GROQ_API_KEY')?.trim();
    this.model = config.get<string>('LLM_MODEL') || 'qwen/qwen3.8-27b';
    this.client = apiKey
      ? new OpenAI({
          apiKey,
          baseURL: config.get<string>('LLM_BASE_URL') || 'https://api.groq.com/openai/v1',
          maxRetries: 1,
          timeout: 15_000,
        })
      : null;

    if (!this.client) this.logger.warn('GROQ_API_KEY not set: using rule-based parsing and no AI summaries.');
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * One step of a tool-calling conversation: the model either answers in text or asks to call tools.
   * Returns null when the LLM is off. Throws on API errors so the caller can tell the user why (e.g. rate limit).
   */
  async chat(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tools: OpenAI.Chat.ChatCompletionTool[],
  ): Promise<OpenAI.Chat.ChatCompletionMessage | null> {
    if (!this.client) return null;
    const start = Date.now();
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 1500, // stops runaway replies; lower values cut tool calls short (the model reasons first)
      });
      const message = res.choices[0]?.message ?? null;
      const calls = message?.tool_calls?.map(c => (c.type === 'function' ? c.function.name : c.type)) ?? [];
      this.logger.log(`chat → ${this.model}: ${Date.now() - start}ms, ${res.usage?.total_tokens ?? '?'} tokens, ${calls.length ? `tools: ${calls.join(', ')}` : 'text reply'}`);
      return message;
    } catch (err: any) {
      this.logger.warn(`chat → ${this.model} failed after ${Date.now() - start}ms: ${err.message}`);
      throw err;
    }
  }

  /** Returns the model's text reply, or null when the LLM is off or the call fails. */
  async askText(prompt: string): Promise<string | null> {
    if (!this.client) return null;
    const start = Date.now();
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      this.logger.log(`askText → ${this.model}: ${Date.now() - start}ms, ${res.usage?.total_tokens ?? '?'} tokens`);
      return res.choices[0]?.message?.content?.trim() || null;
    } catch (err: any) {
      this.logger.warn(`askText → ${this.model} failed after ${Date.now() - start}ms: ${err.message}`);
      return null;
    }
  }

  /** Returns the model's reply parsed as JSON, or null on any failure so callers can fall back to rules. */
  async askJson<T>(prompt: string): Promise<T | null> {
    if (!this.client) return null;
    const start = Date.now();
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' }, // JSON mode: the prompt must mention "JSON"
      });
      this.logger.log(`askJson → ${this.model}: ${Date.now() - start}ms, ${res.usage?.total_tokens ?? '?'} tokens`);
      return JSON.parse(res.choices[0]?.message?.content || 'null') as T;
    } catch (err: any) {
      this.logger.warn(`askJson → ${this.model} failed after ${Date.now() - start}ms: ${err.message}`);
      return null;
    }
  }
}
