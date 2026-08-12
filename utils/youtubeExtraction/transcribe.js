require("dotenv").config();

const fs = require("fs");
const OpenAI = require("openai");

const openai = new OpenAI();

async function transcribeChunk(chunk, index,language) {
    try {
        console.log(`Transcribing chunk ${index + 1}:`, chunk);

        const transcription = await openai.audio[
    language === "hindi" ? "translations" : "transcriptions"
].create({
            file: fs.createReadStream(chunk),
            model: "whisper-1",
        });

        console.log(`Finished chunk ${index + 1}`);

        return {
            index,
             success: true,
            text: transcription.text,
        };

    } catch (error) {
        console.error(`Failed chunk ${index + 1}:`, chunk);
        console.error("Status:", error.status);
        console.error("Message:", error.message);

        return {
            index,
            success: false,
            error: error.message,
        };
    }
}

exports.transcribe = async (chunks,language) => {

    const concurrency = 3;
    const results = [];

    for (let i = 0; i < chunks.length; i += concurrency) {

        const batch = chunks.slice(i, i + concurrency);

        console.log(
            `Processing chunks ${i + 1} to ${i + batch.length}`
        );

        const batchResults = await Promise.all(
            batch.map((chunk, index) =>
                transcribeChunk(chunk, i + index,language)
            )
        );

        results.push(...batchResults);
    }

    // Keep the original audio order
    results.sort((a, b) => a.index - b.index);

    return results
};