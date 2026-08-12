require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ChatOpenAI } = require("@langchain/openai");
const llm = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.OPENAI_API_KEY,
  maxTokens: 400,
});
exports.finalSummary = async (initialSummary) => {
 
    const aiMsg = await llm.invoke([
      {
        role: "system",
        content:
          `You are an expert meeting summarizer. Combine these partial summaries into ONE final professional meeting summary in bullet points. Keep it tight: 8-12 bullets maximum, one line each. Merge overlapping points from different chunks into a single bullet instead of repeating them. Prioritize decisions, action items, and key takeaways over minor discussion detail.`,
      },
      {
        role: "user",
        content: initialSummary,
      },
    ]);
   
  return aiMsg.content;
};