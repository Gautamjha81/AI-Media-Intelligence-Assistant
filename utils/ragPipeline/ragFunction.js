const { Store } = require("./vectorStore");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 100,
});

exports.ragFunction = async (texts, videoId) => {
  try {
    // 1. Split transcript into chunks
    const chunks = await splitter.splitText(texts);

    // 2. Create vector store
    const vectorStore = await Store(chunks, videoId);
    return vectorStore;

  } catch (error) {
    console.error("Error in RAG function:", error);
    throw error;
  }
};