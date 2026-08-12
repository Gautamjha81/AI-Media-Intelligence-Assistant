require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ChatOpenAI } = require("@langchain/openai");
const llm = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.OPENAI_API_KEY,
});
exports.finalSummary = async (initialSummary) => {
 
    const aiMsg = await llm.invoke([
      {
        role: "system",
        content:
          `You are an expert meeting summarizer. Combine these partial summaries into one final professional meeting summary in bullet points.`,
      },
      {
        role: "user",
        content: initialSummary,
      },
    ]);
   
  return aiMsg.content;
};
