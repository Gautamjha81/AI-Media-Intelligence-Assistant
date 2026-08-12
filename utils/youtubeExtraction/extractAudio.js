const { downloadYoutubeAudio } = require("./youtube");
const { convertTo16kHz, chunkAudio } = require("./audio");
const { transcribe } = require("./transcribe");
const { getYoutubeCaptions } = require("./captions");

async function extractAudio(url, language = "english") {
  // 1. Try existing YouTube captions first. This avoids downloading
  // audio entirely, is much faster/cheaper, and - importantly - hits a
  // far lighter YouTube endpoint than resolving playable audio formats,
  // so it's much less likely to trip "Sign in to confirm you're not a
  // bot" on a datacenter IP.
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

  // 2. Fall back: download audio and transcribe with Whisper (the
  // original pipeline). This is the path that needs cookies and is
  // subject to YouTube's bot detection.
  const inputPath = await downloadYoutubeAudio(url);
  const result = await convertTo16kHz(inputPath);
  const chunks = await chunkAudio(result);
  const resultText = await transcribe(chunks, language);
  return resultText;
}

module.exports = extractAudio;
