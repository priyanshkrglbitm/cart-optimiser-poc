import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { GeminiSupervisorAgent } from './agents/geminiSupervisorAgent';
import { UniversalBasketResponse } from './types/commerce';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`🌐 [HTTP Request] ${req.method} ${req.url}`);
  }
  next();
});

import { GroqSupervisorAgent } from './agents/groqSupervisorAgent';

let supervisor: any;
if (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.startsWith('your_')) {
  supervisor = new GroqSupervisorAgent();
} else if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('your_')) {
  supervisor = new GeminiSupervisorAgent();
} else {
  console.warn('⚠️ No GEMINI_API_KEY or GROQ_API_KEY found. Falling back to base SupervisorAgent without AI summaries.');
  const { SupervisorAgent } = require('./agents/supervisorAgent');
  supervisor = new SupervisorAgent();
}

app.post('/api/optimize-basket', async (req, res) => {
  try {
    const { items, location } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of item queries in "items".' });
    }

    console.log(`\n📥 [Server] Received Basket Search Request: [ ${items.map(i => `"${i}"`).join(', ')} ]`);
    if (location) {
      console.log(`📍 Location Context: Lat ${location.latitude}, Lng ${location.longitude} (${location.address || 'DarkStore'})`);
    }

    const result: UniversalBasketResponse = await supervisor.optimizeBasket(items, location);

    console.log(`✅ [Server] Optimization Finished! Best Single Store: ${result.overallBestSinglePlatform?.platform?.name || 'N/A'} (₹${result.overallBestSinglePlatform?.totalCost || 0})`);
    return res.json(result);
  } catch (err: any) {
    console.error('❌ [Server Error] Error optimizing basket:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

const startServer = (portToTry: number) => {
  const server = app.listen(portToTry, '127.0.0.1', () => {
    console.log(`\n🚀 Universal Multi-Agent Price Comparison Engine Running!`);
    console.log(`📡 MCP Protocol & OpenAI LLM Agent Active`);
    console.log(`🌐 Web Dashboard: http://127.0.0.1:${portToTry}`);
    console.log(`📡 API Endpoint:  http://127.0.0.1:${portToTry}/api/optimize-basket\n`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE' || err.code === 'EPERM') {
      if (portToTry < 3010) {
        startServer(portToTry + 1);
      }
    }
  });
};

startServer(PORT);
