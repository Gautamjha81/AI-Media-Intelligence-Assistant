require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ChatOpenAI } = require("@langchain/openai");
const llm = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.OPENAI_API_KEY,
  maxTokens: 200,
});
exports.initialSummary = async (chunks) => {
  const summary = [];
  for (const chunk of chunks) {
    const aiMsg = await llm.invoke([
      {
        role: "system",
        content:
          "Summarize this portion of a meeting transcript in 3-5 short bullet points (max ~60 words total). Only include key points, decisions, and important information - skip minor details and filler.",
      },
      {
        role: "user",
        content: chunk,
      },
    ]);
    summary.push(aiMsg.content);
  }
  return summary.join(" ");
};