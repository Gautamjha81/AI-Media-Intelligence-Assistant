const youtubedl = require("youtube-dl-exec");
const path = require("path");
const fs = require("fs");

exports.downloadYoutubeAudio = async (url) => {

    const outputDir = path.join(__dirname, "../uploads");

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
        outputDir,
        "%(id)s.%(ext)s"
    );

    await youtubedl(url, {
        format: "bestaudio",
        output: outputPath,
        noPlaylist: true
    });

    const files = fs.readdirSync(outputDir);

    const audioFile = files.find((file) =>
        /\.(webm|m4a|mp3|opus|wav)$/i.test(file)
    );

    if (!audioFile) {
        throw new Error("Audio file was not downloaded");
    }

    const audioPath = path.join(
        outputDir,
        audioFile
    );

    return audioPath;
};
