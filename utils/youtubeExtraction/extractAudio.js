const { downloadYoutubeAudio } = require("./youtube");
const { convertTo16kHz, chunkAudio } = require("./audio");
const { transcribe } = require("./transcribe");
const { getYoutubeCaptions } = require("./captions");

async function extractAudio(url, language = "english") {
  try {
    const captionText = await getYoutubeCaptions(url, language);
    if (captionText) {
      return [{ index: 0, success: true, text: captionText }];
    }
    console.log(
      "No usable captions found - falling back to audio download + Whisper transcription"
    );
  } catch (err) {
    console.warn(
      "Caption fetch failed unexpectedly, falling back to audio download:",
      err.message
    );
  }

  const inputPath = await downloadYoutubeAudio(url);
  const result = await convertTo16kHz(inputPath);
  const chunks = await chunkAudio(result);
  const resultText = await transcribe(chunks, language);
  return resultText;
}

module.exports = extractAudio;
