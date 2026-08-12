const { getSubtitles } = require("youtube-caption-extractor");

// Extracts the 11-char YouTube video ID from any common URL shape:
// watch?v=, youtu.be/, /shorts/, /live/, /embed/
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

// Maps our app's "english" / "hindi" language selector to caption
// language codes to try, in priority order. Hindi falls back to
// English captions if no Hindi track exists (still useful signal,
// same as how Whisper "translations" would produce English text).
const LANG_PREFERENCE = {
    hindi: ["hi", "en"],
    english: ["en"],
};

/**
 * Attempts to fetch existing captions for a YouTube video.
 * Returns the joined caption text, or null if no usable captions exist.
 * Throws only on unexpected/network-level errors - "no captions found"
 * is treated as a normal null return so callers can fall back cleanly.
 */
exports.getYoutubeCaptions = async (url, language = "english") => {
    const videoID = extractVideoId(url);
    if (!videoID) {
        console.warn(`Could not parse a video ID from URL: ${url}`);
        return null;
    }

    const langsToTry = LANG_PREFERENCE[language] || ["en"];

    for (const lang of langsToTry) {
        try {
            const subtitles = await getSubtitles({ videoID, lang });

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
            // No captions in this language (or none at all) - try the
            // next language in the list, or fall back to audio download.
            console.warn(
                `No captions for ${videoID} (lang=${lang}): ${err.message}`
            );
        }
    }

    return null;
};
