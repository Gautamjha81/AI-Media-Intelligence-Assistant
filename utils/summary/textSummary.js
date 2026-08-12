const { initialSummary } = require("./youtube/initialSummary");
const { finalSummary } = require("./youtube/finalSummary");
const { initialSummary: initialMeetingSummary } = require("./meeting/initialSummary");
const { finalSummary: finalMeetingSummary } = require("./meeting/finalSummary");

const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
exports.textSummary = async (text, textFrom) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 3000,
    chunkOverlap: 200,
  });
  const chunks = await splitter.splitText(text);
  if (textFrom === "youtube") {
    const summary = await initialSummary(chunks);
    const finalResult = await finalSummary(summary);
    return finalResult;
  } else {
    const summary = await initialMeetingSummary(chunks);
    const finalResult = await finalMeetingSummary(summary);
     return finalResult;
  }
};
