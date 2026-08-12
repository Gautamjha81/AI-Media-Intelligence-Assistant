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
        content: `
Extract the key information from this meeting transcript chunk:
discussion points, decisions, action items, owners, deadlines,
and unresolved questions. Do not invent information.
`,
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
