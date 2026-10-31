import dotenv from 'dotenv';

dotenv.config();

// All settings come from .env (see .env.example). Nothing else should read process.env.
export const config = {
  port: Number(process.env.PORT) || 3000,
  llm: {
    apiKey: process.env.GROQ_API_KEY?.trim() || '',
    // Any OpenAI-compatible provider works: change these two to switch (Gemini, OpenRouter, local Ollama).
    baseURL: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.LLM_MODEL || 'qwen/qwen3.8-27b',
  },
};
