const youtubedl = require("youtube-dl-exec");
const path = require("path");
const fs = require("fs");

const COOKIES_PATH =
    process.env.YOUTUBE_COOKIES_PATH ||
    path.join(__dirname, "../../config/cookies.txt");

// YouTube's bot-check behaves differently per "player client". On a
// datacenter IP (AWS/GCP/etc.) one client often gets challenged while
// another sails through. We try a short list in order and fall back
// on failure instead of giving up after a single attempt.
const PLAYER_CLIENTS = ["web_safari", "android", "tv"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.downloadYoutubeAudio = async (url) => {
    const outputDir = path.join(__dirname, "../uploads");

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
        outputDir,
        "%(id)s.%(ext)s"
    );

    const baseOptions = {
        format: "bestaudio/best",
        output: outputPath,
        noPlaylist: true,

        // Required for current YouTube extraction
        jsRuntimes: "deno",
        remoteComponents: "ejs:npm",

        // Slow down slightly so requests look less like a scripted burst
        sleepRequests: 2,
    };

    // Add cookies only if the file exists
    if (fs.existsSync(COOKIES_PATH)) {
        baseOptions.cookies = COOKIES_PATH;
        console.log(`Using YouTube cookies: ${COOKIES_PATH}`);
    } else {
        console.warn(
            `No cookies file found at ${COOKIES_PATH} - YouTube may block this download.`
        );
    }

    let lastError;

    for (const client of PLAYER_CLIENTS) {
        const options = {
            ...baseOptions,
            extractorArgs: `youtube:player_client=${client}`,
        };

        try {
            console.log(`Attempting YouTube download with player_client=${client}`);
            await youtubedl(url, options);
            console.log(`Succeeded with player_client=${client}`);
            lastError = null;
            break;
        } catch (err) {
            lastError = err;
            const isBotCheck = /Sign in to confirm/i.test(err?.stderr || err?.message || "");
            console.warn(
                `player_client=${client} failed${isBotCheck ? " (bot check)" : ""}: ${err?.message || err}`
            );
            // brief pause before trying the next client
            await sleep(1500);
        }
    }

    if (lastError) {
        throw lastError;
    }

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