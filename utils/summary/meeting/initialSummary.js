require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ChatOpenAI } = require("@langchain/openai");
const llm = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.OPENAI_API_KEY,
  maxTokens: 450,
});
exports.finalSummary = async (initialSummary) => {
 
    const aiMsg = await llm.invoke([
      {
        role: "system",
        content:`
Create a concise meeting summary from these partial summaries, organized
under three short headers: Key Decisions, Action Items (include owner and
deadline if mentioned), and Open Questions. Keep it tight - 10-15 bullets
total maximum across all sections, one line each. Remove repetition by
merging overlapping points from different chunks. Do not invent information.
`,
      },
      {
        role: "user",
        content: initialSummary,
      },
    ]);
   
  return aiMsg.content;
};