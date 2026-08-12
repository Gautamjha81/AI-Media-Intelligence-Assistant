require("dotenv").config();

const { OpenAIEmbeddings } = require("@langchain/openai");
const { MemoryVectorStore } = require("@langchain/classic/vectorstores/memory");

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  batchSize: 512,
  model: "text-embedding-3-large",
});

const stores = new Map();

exports.Store = async (texts, videoId) => {
  try {
    const vectorStore = new MemoryVectorStore(embeddings);

    await vectorStore.addDocuments(
      texts.map((text) => ({
        pageContent: text,
        metadata: {}
      }))
    );

    stores.set(videoId, vectorStore);

    setTimeout(() => {
      stores.delete(videoId);
      console.log(`Vector store deleted for video: ${videoId}`);
    }, 10 * 60 * 1000);

    return vectorStore;

  } catch (error) {
    console.error("Error creating vector store:", error);
    throw error;
  }
};