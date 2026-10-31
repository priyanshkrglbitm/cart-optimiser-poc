import dotenv from 'dotenv';
import { LocationContext, UniversalBasketResponse } from '../types/commerce';
import { SupervisorAgent } from './supervisorAgent';

dotenv.config();

export class GeminiSupervisorAgent {
  private apiKey: string | null = null;
  private fallbackSupervisor: SupervisorAgent;
  private responseCache = new Map<string, string>();

  constructor() {
    this.fallbackSupervisor = new SupervisorAgent();
    const key = process.env.GEMINI_API_KEY;
    
    if (key && key !== 'your_gemini_api_key_here') {
      const cleanKey = key.replace(/["']/g, '').trim();
      if (!cleanKey.startsWith('AIzaSy')) {
        console.warn('\n⚠️  [Gemini Key Warning] Your GEMINI_API_KEY starts with "' + cleanKey.substring(0, 5) + '...". Google AI Studio API keys MUST start with "AIzaSy...". Get a free key at https://aistudio.google.com/app/apikey\n');
      }
      this.apiKey = cleanKey;
      console.log('🤖 Google Gemini AI Integration Initialized (Autonomous Agent Mode)');
    } else {
      console.log('💡 GEMINI_API_KEY not configured. Running in High-Speed Deterministic Agent Mode.');
    }
  }

  public async optimizeBasket(
    rawItemQueries: string[], 
    location?: LocationContext
  ): Promise<UniversalBasketResponse> {
    const baseResult = await this.fallbackSupervisor.optimizeBasket(rawItemQueries, location);

    if (!this.apiKey) {
      return baseResult;
    }

    // Check if ANY store failed to return items. If so, skip LLM to save tokens!
    const allStoresHaveData = baseResult.platformSummaries.every((store: any) => store.items.length > 0 && store.items.every((i: any) => i !== null));
    
    if (!baseResult.overallBestSinglePlatform || baseResult.overallBestSinglePlatform.totalCost === 0 || !allStoresHaveData) {
      console.log(`[GeminiSupervisorAgent] 🛑 Skipping LLM generation: Not all scrapers returned data (or total cost is 0). Saving tokens!`);
      return baseResult;
    }

    const cacheKey = JSON.stringify({ items: rawItemQueries, store: baseResult.overallBestSinglePlatform?.platform?.name });
    if (this.responseCache.has(cacheKey)) {
      console.log(`[GeminiSupervisorAgent] ⚡ Serving cached AI insights...`);
      baseResult.agentLogs.push(`[Google Gemini Insights]: ${this.responseCache.get(cacheKey)}`);
      return baseResult;
    }

    try {
      console.log(`[GeminiSupervisorAgent] Invoking Gemini AI autonomous reasoning for ${rawItemQueries.length} items...`);

      const promptText = `You are an AI Shopping Assistant Supervisor. Summarize the grocery basket optimization results in 2 concise sentences for the user.\n` +
        `Location: ${location ? `${location.latitude},${location.longitude} (${location.address || ''})` : 'Default'}\n` +
        `Shopping Basket: ${JSON.stringify(rawItemQueries)}\n` +
        `Best Single Store: ${baseResult.overallBestSinglePlatform?.platform?.name} (Total: ₹${baseResult.overallBestSinglePlatform?.totalCost})\n` +
        `Split Basket Extra Savings: ₹${baseResult.splitCartRecommendation.savingsVersusBestSinglePlatform}`;

      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      };

      const endpointsToTry = [
        { apiVersion: 'v1beta', model: 'gemini-1.5-flash-latest' },
        { apiVersion: 'v1beta', model: 'gemini-1.5-flash-8b' },
        { apiVersion: 'v1beta', model: 'gemini-1.5-flash-002' },
        { apiVersion: 'v1beta', model: 'gemini-1.5-flash' },
        { apiVersion: 'v1beta', model: 'gemini-2.0-flash-exp' },
        { apiVersion: 'v1beta', model: 'gemini-2.0-flash' },
        { apiVersion: 'v1beta', model: 'gemini-1.5-pro-latest' },
        { apiVersion: 'v1beta', model: 'gemini-1.5-pro' }
      ];

      let aiSummary = '';

      for (const ep of endpointsToTry) {
        try {
          const url = `https://generativelanguage.googleapis.com/${ep.apiVersion}/models/${ep.model}:generateContent?key=${this.apiKey}`;
          console.log(`[GeminiSupervisorAgent] 🔄 Trying Endpoint: [${ep.apiVersion}] ${ep.model}...`);

          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }]
            })
          });

          const data: any = await res.json();

          if (res.status === 200 && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            aiSummary = data.candidates[0].content.parts[0].text.trim();
            console.log(`[GeminiSupervisorAgent] 🎉 SUCCESS! Generated AI insights using [${ep.apiVersion}] ${ep.model}`);
            break;
          } else if (data.error) {
            console.log(`[GeminiSupervisorAgent] ❌ Endpoint [${ep.apiVersion}] ${ep.model} returned HTTP ${res.status}: ${data.error.message}`);
          }
        } catch (e: any) {
          console.warn(`[GeminiSupervisorAgent] Fetch Exception: ${e.message}`);
        }
      }

      if (aiSummary) {
        this.responseCache.set(cacheKey, aiSummary);
        baseResult.agentLogs.push(`[Google Gemini Insights]: ${aiSummary}`);
      }

      return baseResult;

    } catch (err: any) {
      console.warn('[GeminiSupervisorAgent] Error contacting Gemini API, falling back to local orchestrator:', err.message);
      return baseResult;
    }
  }
}
