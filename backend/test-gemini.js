const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../.env' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
model.generateContent('Say hello in one word').then(r => {
  console.log('SUCCESS:', r.response.text());
}).catch(err => {
  console.error('ERROR status:', err.status);
  console.error('ERROR message:', err.message);
  console.error('ERROR details:', JSON.stringify(err.errorDetails || err.details || {}));
});
