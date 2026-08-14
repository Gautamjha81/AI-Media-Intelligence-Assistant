const youtubedl = require("youtube-dl-exec");
const path = require("path");
const fs = require("fs");

const PROXY_URL = process.env.YOUTUBE_PROXY_URL;

const PLAYER_CLIENTS = ["web_safari", "android", "tv"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SARCASTIC_BOT_CHECK_MESSAGE =
    "Youtube has increased their bot security but we are trying our best to bypass that, still you can use other features of this application";

exports.downloadYoutubeAudio = async (url) => {
    const outputDir = path.join(__dirname, "../uploads");

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, "%(id)s.%(ext)s");

    const baseFlags = {
        format: "bestaudio/best",
        output: outputPath,
        noPlaylist: true,
        print: "after_move:filepath",
        jsRuntimes: "deno",
        remoteComponents: "ejs:npm",
        sleepRequests: 2,
    };

    if (PROXY_URL) {
        baseFlags.proxy = PROXY_URL;
        console.log("YOUTUBE_PROXY_URL is set - routing yt-dlp requests through proxy");
    }

    let lastError;
    let downloadedPath;

    for (const client of PLAYER_CLIENTS) {
        const flags = {
            ...baseFlags,
            extractorArgs: `youtube:player_client=${client}`,
        };

        try {
            console.log(`Attempting YouTube download with player_client=${client}`);
            const output = await youtubedl(url, flags);

            const candidatePaths = String(output)
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);

            downloadedPath = [...candidatePaths]
                .reverse()
                .find((line) => fs.existsSync(line));

            if (!downloadedPath) {
                throw new Error(
                    `yt-dlp reported success but printed no existing file path (output: ${String(output).slice(0, 500)})`
                );
            }

            console.log(`Succeeded with player_client=${client}: ${downloadedPath}`);
            lastError = null;
            break;
        } catch (err) {
            lastError = err;
            const isBotCheck = /Sign in to confirm/i.test(err?.stderr || err?.message || "");
            console.warn(
                `player_client=${client} failed${isBotCheck ? " (bot check)" : ""}: ${err?.message || err}`
            );
            await sleep(1500);
        }
    }

    if (lastError) {
        const isBotCheck = /Sign in to confirm/i.test(
            lastError?.stderr || lastError?.message || ""
        );

        if (isBotCheck) {
            const friendly = new Error(SARCASTIC_BOT_CHECK_MESSAGE);
            friendly.code = "YOUTUBE_BOT_CHECK";
            friendly.cause = lastError;
            throw friendly;
        }

        throw lastError;
    }

    return downloadedPath;
};
