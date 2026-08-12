const youtubedl = require("youtube-dl-exec");
const path = require("path");
const fs = require("fs");

const COOKIES_PATH =
    process.env.YOUTUBE_COOKIES_PATH ||
    path.join(__dirname, "../../config/cookies.txt");

exports.downloadYoutubeAudio = async (url) => {
    const outputDir = path.join(__dirname, "../uploads");

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
        outputDir,
        "%(id)s.%(ext)s"
    );

    const options = {
        format: "bestaudio/best",
        output: outputPath,
        noPlaylist: true,

        // Required for current YouTube extraction
        jsRuntimes: "deno",
        remoteComponents: "ejs:npm"
    };

    // Add cookies only if the file exists
    if (fs.existsSync(COOKIES_PATH)) {
        options.cookies = COOKIES_PATH;
        console.log(`Using YouTube cookies: ${COOKIES_PATH}`);
    } else {
        console.warn(
            `No cookies file found at ${COOKIES_PATH} - YouTube may block this download.`
        );
    }

    await youtubedl(url, options);

    const files = fs.readdirSync(outputDir);

    const audioFile = files.find((file) =>
        /\.(webm|m4a|mp3|opus|wav)$/i.test(file)
    );

    if (!audioFile) {
        throw new Error("Audio file was not downloaded");
    }

    const audioPath = path.join(outputDir, audioFile);

    return audioPath;
};