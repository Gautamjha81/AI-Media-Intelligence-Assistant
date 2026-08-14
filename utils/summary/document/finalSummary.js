require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ChatOpenAI } = require("@langchain/openai");
const llm = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.OPENAI_API_KEY,
});
exports.finalDocumentSummary = async (initialSummary) => {

    const aiMsg = await llm.invoke([
      {
        role: "system",
        content:
          `Combine these partial summaries into ONE final summary of the document. Write it as clear prose or bullet points, whichever fits the content better - do not force it into a meeting-style format with decisions, action items, or open questions unless the document itself is actually about a meeting. Keep it tight: 8-12 points maximum. Merge overlapping points from different chunks instead of repeating them. Do not invent information.`,
      },
      {
        role: "user",
        content: initialSummary,
      },
    ]);

  return aiMsg.content;
};
