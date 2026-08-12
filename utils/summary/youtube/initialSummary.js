require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ChatOpenAI } = require("@langchain/openai");
const llm = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.OPENAI_API_KEY,
});
exports.initialSummary = async (chunks) => {
  const summary = [];
  for (const chunk of chunks) {
    const aiMsg = await llm.invoke([
      {
        role: "system",
        content:
          "Summarize this portion of a meeting transcript concisely. Focus on the key points, decisions, and important information.",
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
