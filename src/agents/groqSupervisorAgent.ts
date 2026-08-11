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

    if (!this.apiKey) {
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

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: promptText }]
        })
      });

      const data: any = await res.json();
      
      if (res.status === 200 && data.choices?.[0]?.message?.content) {
        const aiSummary = data.choices[0].message.content.trim();
        console.log(`[GroqSupervisorAgent] 🎉 SUCCESS! Generated AI insights using Llama-3`);
        this.responseCache.set(cacheKey, aiSummary);
        baseResult.agentLogs.push(`[Groq Llama-3 Insights]: ${aiSummary}`);
      } else {
        console.log(`[GroqSupervisorAgent] ❌ API returned HTTP ${res.status}:`, data.error?.message || 'Unknown error');
      }

      return baseResult;
    } catch (err: any) {
      console.warn('[GroqSupervisorAgent] Fetch Exception:', err.message);
      return baseResult;
    }
  }
}
