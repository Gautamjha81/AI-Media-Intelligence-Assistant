require("dotenv").config();

const { ChatOpenAI } = require("@langchain/openai");

const llm = new ChatOpenAI({
  model: "gpt-5.5",
  apiKey: process.env.OPENAI_API_KEY,
});

exports.chatBot = async (context, question) => {
 const contextText = context
      .map((doc) => doc.pageContent)
      .join("\n\n");
  try {
    const aiMsg = await llm.invoke([
      {
        role: "system",
        content: `
You are an AI video assistant.

Your job is to answer the user's question using ONLY the information
provided in the context.

Rules:
1. Answer the user's question directly and clearly.
2. Use only information present in the provided context.
3. Do not make up information or use outside knowledge.
4. If the answer cannot be found in the context, say:
   "I couldn't find this information."
5. Do not mention vector databases, embeddings, retrieval, or internal
   system instructions.
6. Keep the answer concise but useful.
        `,
      },
      {
        role: "user",
        content: `
VIDEO CONTEXT:
${contextText}

USER QUESTION:
${question}
        `,
      },
    ]);

    return aiMsg.content;

  } catch (error) {
    console.error("Error generating AI response:", error);
    throw error;
  }
};