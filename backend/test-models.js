const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../.env' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Try models in order of preference
const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-pro'];

async function tryModels() {
  for (const m of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const r = await model.generateContent('Say hello in one word. No punctuation.');
      console.log(`✅ ${m} works: ${r.response.text().trim()}`);
      return m;
    } catch(e) {
      console.log(`❌ ${m}: ${e.status || ''} ${e.message?.slice(0,80)}`);
    }
  }
}
tryModels();
