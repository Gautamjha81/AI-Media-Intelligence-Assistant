const { downloadYoutubeAudio } = require("./youtube");
const { convertTo16kHz, chunkAudio } = require("./audio");
const {transcribe}=require("./transcribe")

async function extractAudio(url) {
  const inputPath = await downloadYoutubeAudio(url);
  const result = await convertTo16kHz(inputPath);
  const chunks = await chunkAudio(result);
  const language="hindi"
  const resultText=await transcribe(chunks,language);
  return resultText;
}
module.exports = extractAudio;
