require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ChatOpenAI } = require("@langchain/openai");
const llm = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.OPENAI_API_KEY,
  maxTokens: 300,
});
exports.initialDocumentSummary = async (chunks) => {
  const summary = [];
  for (const chunk of chunks) {
    const aiMsg = await llm.invoke([
      {
        role: "system",
        content:
          "Summarize this portion of a document in 3-5 short bullet points (max ~80 words total). Capture the main ideas, facts, and any notable details. Do not invent information not present in the text.",
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
