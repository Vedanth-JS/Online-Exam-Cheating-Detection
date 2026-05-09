const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: "../.env" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
model.generateContent("Say hi").then(r => {
  console.log("SUCCESS:", r.response.text());
}).catch(err => {
  console.log("status:", err.status);
  // Print the full error to see retry-after or quota details
  const msg = err.message || "";
  const retryAfter = msg.match(/retryDelay.*?(\d+s)/)?.[1] || "unknown";
  console.log("retryAfter:", retryAfter);
  console.log("full:", msg.slice(0, 500));
});
