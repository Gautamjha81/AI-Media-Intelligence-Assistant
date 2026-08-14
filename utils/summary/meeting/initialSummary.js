require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const { ChatOpenAI } = require("@langchain/openai");
const llm = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.OPENAI_API_KEY,
  maxTokens: 450,
});
exports.initialMeetingSummary = async (chunks) => {
     const array=[];
    for(const chunk of chunks){
      const aiMsg = await llm.invoke([
      {
        role: "system",
        content:`
        Create a concise meeting summary from these partial summaries.
Include key points, decisions, action items, owners, deadlines,
and unresolved questions. Remove repetition. Do not invent information
`,
      },
      {
        role: "user",
        content: chunk,
      },
    ]);
    array.push(aiMsg.content)
    }
   
  return array.join("");
};