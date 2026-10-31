import dotenv from 'dotenv';
import { LocationContext, UniversalBasketResponse } from '../types/commerce';
import { SupervisorAgent } from './supervisorAgent';

dotenv.config();

export class GroqSupervisorAgent {
  private apiKey: string | null = null;
  private fallbackSupervisor: SupervisorAgent;
  private responseCache = new Map<string, string>();

  constructor() {
    this.fallbackSupervisor = new SupervisorAgent();
    const key = process.env.GROQ_API_KEY;
    
    if (key && key !== 'your_groq_api_key_here') {
      this.apiKey = key.trim();
      console.log('🤖 Groq Llama-3 Integration Initialized (Autonomous Agent Mode)');
    }
  }

  public async optimizeBasket(
    rawItemQueries: string[], 
    location?: LocationContext
  ): Promise<UniversalBasketResponse> {
    const baseResult = await this.fallbackSupervisor.optimizeBasket(rawItemQueries, location);


    // Check if ANY store returned items. If none did, skip LLM.
    const anyStoreHasData = baseResult.platformSummaries.some((store: any) => store.items.length > 0 && store.items.some((i: any) => i !== null));
    
    if (!baseResult.overallBestSinglePlatform || baseResult.overallBestSinglePlatform.totalCost === 0 || !anyStoreHasData) {
      console.log(`[GroqSupervisorAgent] 🛑 Skipping LLM generation: No scrapers returned data (or total cost is 0). Saving tokens!`);
      return baseResult;
    }

    const cacheKey = JSON.stringify({ items: rawItemQueries, store: baseResult.overallBestSinglePlatform?.platform?.name });
    if (this.responseCache.has(cacheKey)) {
      console.log(`[GroqSupervisorAgent] ⚡ Serving cached AI insights...`);
      baseResult.agentLogs.push(`[Groq Llama-3 Insights]: ${this.responseCache.get(cacheKey)}`);
      return baseResult;
    }

    try {
      console.log(`[GroqSupervisorAgent] Invoking Groq Llama-3 reasoning for ${rawItemQueries.length} items...`);

      const promptText = `You are an AI Shopping Assistant Supervisor. Summarize the grocery basket optimization results in 2 concise sentences for the user.\n` +
        `Location: ${location ? `${location.latitude},${location.longitude} (${location.address || ''})` : 'Default'}\n` +
        `Shopping Basket: ${JSON.stringify(rawItemQueries)}\n` +
        `Best Single Store: ${baseResult.overallBestSinglePlatform?.platform?.name} (Total: ₹${baseResult.overallBestSinglePlatform?.totalCost})\n` +
        `Split Basket Extra Savings: ₹${baseResult.splitCartRecommendation.savingsVersusBestSinglePlatform}`;

      // Dynamically discover available active models on this key or use standard active models
      let activeModels: string[] = [];
      try {
        const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${this.apiKey}` }
        });
        if (modelsRes.ok) {
          const modelsData: any = await modelsRes.json();
          activeModels = (modelsData.data || [])
            .map((m: any) => m.id)
            .filter((id: string) => !id.includes('whisper') && !id.includes('guard') && !id.includes('tts') && !id.includes('distill-specdec'));
          console.log(`[GroqSupervisorAgent] Auto-discovered ${activeModels.length} active models on Groq:`, activeModels.slice(0, 4).join(', '));
        }
      } catch (_) {}

      const candidateModels = Array.from(new Set([
        ...activeModels,
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama3-70b-8192',
        'mixtral-8x7b-32768',
        'qwen-2.5-32b',
        'deepseek-r1-distill-llama-70b',
        'llama-3.2-11b-vision-preview',
        'llama-3.2-3b-preview',
        'llama-3.2-1b-preview',
        'gemma2-9b-it'
      ]));

      let aiSummary: string | null = null;

      for (const model of candidateModels) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: promptText }]
            })
          });

          const data: any = await res.json();
          if (res.status === 200 && data.choices?.[0]?.message?.content) {
            aiSummary = data.choices[0].message.content.trim();
            console.log(`[GroqSupervisorAgent] 🎉 SUCCESS! Generated AI insights using Groq (${model})`);
            break;
          }
        } catch (_) {}
      }

      if (aiSummary) {
        this.responseCache.set(cacheKey, aiSummary);
        baseResult.agentLogs.push(`[Groq AI Insights]: ${aiSummary}`);
      } else {
        console.log(`[GroqSupervisorAgent] ❌ All Groq models failed to return insights.`);
      }

      return baseResult;
    } catch (err: any) {
      console.warn('[GroqSupervisorAgent] Fetch Exception:', err.message);
      return baseResult;
    }
  }
}
