const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

// Where we keep our own managed copy of the yt-dlp binary. Using a
// project-local folder (rather than relying on PATH) means this works
// identically on a Windows dev machine and on Linux in EB, with no
// manual "install yt-dlp" step required on either.
const BIN_DIR = path.join(__dirname, "../../bin");

function platformBinaryInfo() {
    if (process.platform === "win32") {
        return {
            filename: "yt-dlp.exe",
            url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
        };
    }
    if (process.platform === "darwin") {
        return {
            filename: "yt-dlp_macos",
            url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
        };
    }
    // Standalone Linux build - self-contained, no system Python required.
    return {
        filename: "yt-dlp",
        url: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
    };
}

async function downloadBinary(url, destPath) {
    const res = await fetch(url, { redirect: "follow" });

    if (!res.ok || !res.body) {
        throw new Error(
            `Failed to download yt-dlp binary from ${url}: ${res.status} ${res.statusText}`
        );
    }

    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

    // Download to a temp path first, then rename - avoids leaving a
    // half-written binary in place if the download is interrupted.
    const tmpPath = `${destPath}.download`;
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmpPath));
    await fs.promises.rename(tmpPath, destPath);

    if (process.platform !== "win32") {
        await fs.promises.chmod(destPath, 0o755);
    }
}

let ensurePromise = null;

// Resolves to a path to a working yt-dlp binary, downloading it into
// ./bin on first use if it isn't already there. Set YTDLP_BINARY_PATH
// to point at a system-installed binary instead (e.g. if you manage
// updates yourself via pip/apt on a server).
exports.ensureYtDlpBinary = () => {
    if (process.env.YTDLP_BINARY_PATH) {
        return Promise.resolve(process.env.YTDLP_BINARY_PATH);
    }

    if (!ensurePromise) {
        ensurePromise = (async () => {
            const { filename, url } = platformBinaryInfo();
            const destPath = path.join(BIN_DIR, filename);

            if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
                return destPath;
            }

            console.log(
                `yt-dlp binary not found at ${destPath} - downloading latest release from ${url}`
            );
            await downloadBinary(url, destPath);
            console.log(`yt-dlp binary ready at ${destPath}`);
            return destPath;
        })().catch((err) => {
            // Don't cache a failed attempt - let the next call retry.
            ensurePromise = null;
            throw err;
        });
    }

    return ensurePromise;
};

// Deletes the locally managed binary so the next call re-downloads the
// latest release. Useful if yt-dlp needs updating to handle a new
// YouTube change (has no effect if YTDLP_BINARY_PATH is set).
exports.forceRedownload = async () => {
    if (process.env.YTDLP_BINARY_PATH) return;
    const { filename } = platformBinaryInfo();
    const destPath = path.join(BIN_DIR, filename);
    await fs.promises.rm(destPath, { force: true });
    ensurePromise = null;
};
