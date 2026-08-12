const downloadYoutubeAudio = require("./youtube");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

exports.convertTo16kHz = (inputPath) => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      path.dirname(inputPath),
      `${path.parse(inputPath).name}_16khz.wav`,
    );

    const args = [
      "-y",
      "-i",
      inputPath,

      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",

      outputPath,
    ];

    execFile(ffmpegPath, args, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        return reject(error);
      }

      resolve(outputPath);
    });
  });
};
exports.chunkAudio = (inputPath) => {
  return new Promise((resolve, reject) => {
    const directory = path.dirname(inputPath);
    const baseName = path.parse(inputPath).name;

    const outputPattern = path.join(directory, `${baseName}_chunk_%03d.wav`);

    const args = [
      "-i",
      inputPath,

      "-f",
      "segment",
      "-segment_time",
      "300",

      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",

      outputPattern,
    ];

    execFile(ffmpegPath, args, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        return reject(error);
      }

      // Find all generated chunks
      const chunks = fs
        .readdirSync(directory)
        .filter(
          (file) =>
            file.startsWith(`${baseName}_chunk_`) && file.endsWith(".wav"),
        )
        .sort()
        .map((file) => path.join(directory, file));

      resolve(chunks);
    });
  });
};
