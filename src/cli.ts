import { SupervisorAgent } from './agents/supervisorAgent';
import { GeminiSupervisorAgent } from './agents/geminiSupervisorAgent';
import { GroqSupervisorAgent } from './agents/groqSupervisorAgent';
import { LocationContext, UniversalBasketResponse } from './types/commerce';
import dotenv from 'dotenv';

dotenv.config();

async function runCli() {
  const args = process.argv.slice(2);
  const sampleBasket = args.length > 0 ? args : [
    "Milk",
    "Toor Dal",
    "Butter"
  ];

  // Location context (e.g. Bangalore / Mumbai nearby darkstore coordinates)
  const userLocation: LocationContext = {
    latitude: 12.9716,
    longitude: 77.5946,
    address: 'Indiranagar 100ft Road, Bengaluru',
    city: 'Bengaluru'
  };

  console.log("==========================================================================");
  console.log(" 🛒 LOCATION-AWARE MULTI-VARIANT BASKET PRICE OPTIMIZER");
  console.log("==========================================================================");
  console.log(`📍 User Location: Lat ${userLocation.latitude}, Lng ${userLocation.longitude} (${userLocation.address})`);
  console.log(`Basket Items: [ ${sampleBasket.map(i => `"${i}"`).join(', ')} ]\n`);



  let supervisor: any;
  if (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.startsWith('your_')) {
    supervisor = new GroqSupervisorAgent();
  } else if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('your_')) {
    supervisor = new GeminiSupervisorAgent();
  } else {
    supervisor = new SupervisorAgent();
  }

  const response: UniversalBasketResponse = await supervisor.optimizeBasket(sampleBasket, userLocation);
  response.agentLogs.forEach(log => console.log(log));

  console.log("\n==========================================================================");
  console.log(" 📊 PLATFORM BASKET COST COMPARISON SUMMARY");
  console.log("==========================================================================");

  response.platformSummaries.forEach(s => {
    const typeBadge = s.platform.type === 'QUICK_COMMERCE' ? '⚡ 15-MIN QUICK' : '🚚 1-2 DAY E-COM';
    const statusStr = s.isFullyAvailable ? '✅ 100% In Stock' : `⚠️ ${s.foundItemsCount}/${s.totalRequestedItems} Items`;
    
    console.log(`\n🏢 ${s.platform.name.padEnd(20)} [${typeBadge}]`);
    console.log(`   Items Subtotal:  ₹${s.subtotalPrice}`);
    console.log(`   Delivery Fee:    ₹${s.deliveryFee} (Threshold: ₹${s.platform.freeDeliveryThreshold})`);
    console.log(`   ---------------------------------------------`);
    console.log(`   TOTAL COST:      ₹${s.totalCost}  (${statusStr})`);
    console.log(`   Selected Items:`);
    s.items.forEach((item, idx) => {
      if (item) {
        console.log(`     • [${sampleBasket[idx]}]: ${item.rawTitle} -> ₹${item.price} (MRP: ₹${item.mrp})`);
      } else {
        console.log(`     • [${sampleBasket[idx]}]: ❌ Out of Stock / Not Found`);
      }
    });
  });

  console.log("\n==========================================================================");
  console.log(" 🏆 BEST WINNING PLATFORM:");
  if (response.overallBestSinglePlatform) {
    console.log(`   ${response.overallBestSinglePlatform.platform.name} at ₹${response.overallBestSinglePlatform.totalCost} Total`);
  }

  console.log("\n==========================================================================");
  console.log(" 💡 SPLIT-BASKET MAXIMUM SAVINGS STRATEGY:");
  console.log("==========================================================================");
  console.log(` Optimized Total Cost: ₹${response.splitCartRecommendation.optimizedTotalCost}`);
  console.log(` Extra Savings vs Single Store: ₹${response.splitCartRecommendation.savingsVersusBestSinglePlatform}`);
  console.log("\n Item Assignments:");
  response.splitCartRecommendation.assignments.forEach(a => {
    console.log(`   • ${a.itemQuery.padEnd(20)} -> Buy from [${a.chosenPlatform}] (${a.product.rawTitle}) at ₹${a.itemPrice}`);
  });
  console.log("==========================================================================\n");
}

runCli().catch(console.error);

