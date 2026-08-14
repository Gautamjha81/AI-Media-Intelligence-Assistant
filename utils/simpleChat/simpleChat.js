require("dotenv").config();

const { ChatOpenAI } = require("@langchain/openai");
const { TavilySearch } = require("@langchain/tavily");
const { createAgent } = require("langchain");

// OpenAI model
const llm = new ChatOpenAI({
    model: "gpt-5.5",
    apiKey: process.env.OPENAI_API_KEY,
});

// Tavily web search tool
const tavilySearch = new TavilySearch({
    maxResults: 5,
    topic: "general",
    includeAnswer: true,
});

// Create agent with Tavily tool
const agent = createAgent({
    model: llm,
    tools: [tavilySearch],
});

exports.simpleChat = async (history, message) => {
    try {
        const result = await agent.invoke({
            messages: [
                {
                    role: "system",
                    content: `
You are a helpful, friendly AI assistant.

Answer the user's questions directly and clearly.

Use the web search tool when:
- The user asks about current or recent information.
- The user asks about news.
- The user asks about current prices, products, companies, people, or events.
- The answer may have changed since your training data.
- You are unsure about a factual answer that can be verified online.

Do not use web search for simple general knowledge, casual conversation,
or questions that do not require current information.
                    `,
                },

                ...history,

                {
                    role: "user",
                    content: message,
                },
            ],
        });

        // Get the final AI response
        const messages = result.messages;

        const lastMessage = messages[messages.length - 1];

        return lastMessage.content;

    } catch (error) {
        console.error(
            "Error generating simple chat response:",
            error
        );

        throw error;
    }
};