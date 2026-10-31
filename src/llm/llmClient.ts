import OpenAI from 'openai';
import { config } from '../config';

// Groq speaks the OpenAI API, so the official SDK works by pointing it at Groq's URL.
const client = config.llm.apiKey
  ? new OpenAI({ apiKey: config.llm.apiKey, baseURL: config.llm.baseURL, maxRetries: 1, timeout: 15_000 })
  : null;

export const isLlmEnabled = (): boolean => client !== null;

/** Returns the model's text reply, or null when the LLM is off or the call fails. */
export async function askText(prompt: string): Promise<string | null> {
  if (!client) return null;
  try {
    const res = await client.chat.completions.create({
      model: config.llm.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
    return res.choices[0]?.message?.content?.trim() || null;
  } catch (err: any) {
    console.warn(`[LLM] ${config.llm.model} failed: ${err.message}`);
    return null;
  }
}

/** Returns the model's reply parsed as JSON, or null on any failure so callers can fall back to rules. */
export async function askJson<T>(prompt: string): Promise<T | null> {
  if (!client) return null;
  try {
    const res = await client.chat.completions.create({
      model: config.llm.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' }, // JSON mode: the prompt must mention "JSON"
    });
    return JSON.parse(res.choices[0]?.message?.content || 'null') as T;
  } catch (err: any) {
    console.warn(`[LLM] ${config.llm.model} JSON call failed: ${err.message}`);
    return null;
  }
}
