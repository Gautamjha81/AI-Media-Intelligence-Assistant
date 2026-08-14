const { getSubtitles } = require("youtube-caption-extractor");
const { ProxyAgent, fetch: undiciFetch } = require("undici");

const PROXY_URL = process.env.YOUTUBE_PROXY_URL;

let proxiedFetch;
if (PROXY_URL) {
    const dispatcher = new ProxyAgent(PROXY_URL);
    console.log("YOUTUBE_PROXY_URL is set - routing caption requests through proxy");
    proxiedFetch = (input, init = {}) => undiciFetch(input, { ...init, dispatcher });
}

function extractVideoId(url) {
    try {
        const parsed = new URL(url);

        if (parsed.hostname.includes("youtu.be")) {
            return parsed.pathname.slice(1);
        }

        const v = parsed.searchParams.get("v");
        if (v) return v;

        const parts = parsed.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1] || null;
    } catch {
        return null;
    }
}

const LANG_PREFERENCE = {
    hindi: ["hi", "en"],
    english: ["en"],
};

const PERMANENT_ERROR_PATTERN =
    /video unavailable|private video|removed|deleted|does not exist|no caption/i;

const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSubtitlesWithRetry(videoID, lang) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await getSubtitles({
                videoID,
                lang,
                ...(proxiedFetch ? { fetch: proxiedFetch } : {}),
            });
        } catch (err) {
            lastError = err;
            const message = err?.message || String(err);

            if (PERMANENT_ERROR_PATTERN.test(message)) {
                throw err;
            }

            if (attempt < MAX_ATTEMPTS) {
                const backoffMs = 500 * attempt;
                console.warn(
                    `Caption fetch attempt ${attempt}/${MAX_ATTEMPTS} failed for ${videoID} (lang=${lang}): ${message} - retrying in ${backoffMs}ms`
                );
                await sleep(backoffMs);
            }
        }
    }

    throw lastError;
}

exports.getYoutubeCaptions = async (url, language = "english") => {
    const videoID = extractVideoId(url);
    if (!videoID) {
        console.warn(`Could not parse a video ID from URL: ${url}`);
        return null;
    }

    const langsToTry = LANG_PREFERENCE[language] || ["en"];

    for (const lang of langsToTry) {
        try {
            const subtitles = await fetchSubtitlesWithRetry(videoID, lang);

            if (subtitles && subtitles.length > 0) {
                const text = subtitles
                    .map((s) => s.text)
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim();

                if (text) {
                    console.log(
                        `Using existing YouTube captions for ${videoID} (lang=${lang}, ${subtitles.length} segments)`
                    );
                    return text;
                }
            }
        } catch (err) {
            console.warn(
                `No captions for ${videoID} (lang=${lang}): ${err.message}`
            );
        }
    }

    return null;
};
