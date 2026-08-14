require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const extractAudio = require("./utils/youtubeExtraction/extractAudio");
const { convertTo16kHz, chunkAudio } = require("./utils/youtubeExtraction/audio");
const { transcribe } = require("./utils/youtubeExtraction/transcribe");
const { textSummary } = require("./utils/summary/textSummary");
const { ragFunction } = require("./utils/ragPipeline/ragFunction");
const { chatBot } = require("./chat");
const extractDocument = require("./utils/documentExtraction/extractDocument");
const { simpleChat } = require("./utils/simpleChat/simpleChat");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000;

const simpleChatSessions = new Map();

const uploadDir = path.join(__dirname, "utils", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_AUDIO_EXT = [".mp3", ".wav", ".m4a", ".webm", ".ogg", ".mp4", ".flac"];
const ALLOWED_DOCUMENT_EXT = [".pdf", ".docx", ".txt"];

const ALLOWED_LANGUAGES = ["english", "hindi"];

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname) || ""}`;
      cb(null, unique);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_AUDIO_EXT.includes(ext)) {
      return cb(new Error("Unsupported audio file type."));
    }
    cb(null, true);
  },
});

const uploadDocument = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname) || ""}`;
      cb(null, unique);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_DOCUMENT_EXT.includes(ext)) {
      return cb(new Error("Unsupported document file type."));
    }
    cb(null, true);
  },
});

function cleanupUploadArtifacts(originalPath) {
  try {
    const dir = path.dirname(originalPath);
    const base = path.parse(originalPath).name;
    fs.readdirSync(dir)
      .filter((f) => f.startsWith(base))
      .forEach((f) => {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch (e) {
        }
      });
  } catch (err) {
    console.error("Cleanup failed:", err.message);
  }
}

function getVideoIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get("v") ||
      parsed.pathname.split("/").filter(Boolean).pop() ||
      crypto.randomUUID()
    );
  } catch {
    return crypto.randomUUID();
  }
}

function resolveLanguage(input) {
  const lang = String(input || "english").toLowerCase();
  return ALLOWED_LANGUAGES.includes(lang) ? lang : "english";
}

app.post("/api/process", async (req, res) => {
  const { youtubeUrl, language } = req.body || {};

  if (!youtubeUrl || typeof youtubeUrl !== "string") {
    return res.status(400).json({ error: "youtubeUrl is required" });
  }

  const resolvedLanguage = resolveLanguage(language);

  try {
    const results = await extractAudio(youtubeUrl, resolvedLanguage);

    const failedChunks = results.filter((result) => !result.success);
    if (failedChunks.length > 0) {
      console.log("there is an error");
    }

    const texts = results.map((result) => result.text).join(" ");
    const textFrom = "youtube";

    const summary = await textSummary(texts, textFrom);

    const videoId = getVideoIdFromUrl(youtubeUrl);
    const vectorStore = await ragFunction(texts, videoId);

    sessions.set(videoId, {
      vectorStore,
      texts,
      summary,
      createdAt: Date.now(),
    });

    setTimeout(() => sessions.delete(videoId), SESSION_TTL_MS);

    return res.json({
      videoId,
      summary,
      language: resolvedLanguage,
      failedChunkCount: failedChunks.length,
    });
  } catch (error) {
    console.error("Error processing video:", error);

    if (error.code === "YOUTUBE_BOT_CHECK") {
      return res.status(503).json({
        error: error.message,
        code: "YOUTUBE_BOT_CHECK",
      });
    }

    return res.status(500).json({
      error: "Failed to process video",
      details: error.message,
    });
  }
});

app.post("/api/process-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "An audio file is required (field name: audio)." });
  }

  const language = resolveLanguage(req.body.language);
  const uploadedPath = req.file.path;

  try {
    const converted = await convertTo16kHz(uploadedPath);
    const chunks = await chunkAudio(converted);
    const results = await transcribe(chunks, language);

    const failedChunks = results.filter((result) => !result.success);
    if (failedChunks.length > 0) {
      console.log("there is an error");
    }

    const texts = results.map((result) => result.text).join(" ");
    const textFrom = "meeting";

    const summary = await textSummary(texts, textFrom);

    const audioId = path.parse(req.file.filename).name;
    const vectorStore = await ragFunction(texts, audioId);

    sessions.set(audioId, {
      vectorStore,
      texts,
      summary,
      createdAt: Date.now(),
    });

    setTimeout(() => sessions.delete(audioId), SESSION_TTL_MS);

    return res.json({
      videoId: audioId,
      summary,
      failedChunkCount: failedChunks.length,
    });
  } catch (error) {
    console.error("Error processing uploaded audio:", error);
    return res.status(500).json({
      error: "Failed to process audio",
      details: error.message,
    });
  } finally {
    cleanupUploadArtifacts(uploadedPath);
  }
});

app.post("/api/process-document", uploadDocument.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "A document file is required (field name: document)." });
  }

  const uploadedPath = req.file.path;

  try {
    const { pages, fullText } = await extractDocument(uploadedPath);

    const textFrom = "document";
    const summary = await textSummary(fullText, textFrom);

    const documentId = path.parse(req.file.filename).name;
    const vectorStore = await ragFunction(fullText, documentId);

    sessions.set(documentId, {
      vectorStore,
      texts: fullText,
      summary,
      pages,
      createdAt: Date.now(),
    });

    setTimeout(() => sessions.delete(documentId), SESSION_TTL_MS);

    return res.json({
      videoId: documentId,
      summary,
      pageCount: pages.length,
      pages,
    });
  } catch (error) {
    console.error("Error processing uploaded document:", error);
    return res.status(500).json({
      error: "Failed to process document",
      details: error.message,
    });
  } finally {
    cleanupUploadArtifacts(uploadedPath);
  }
});

app.post("/api/chat", async (req, res) => {
  const { videoId, question } = req.body || {};

  if (!videoId || !question) {
    return res.status(400).json({ error: "videoId and question are required" });
  }

  const session = sessions.get(videoId);
  if (!session) {
    return res.status(404).json({
      error: "Session not found or expired. Process the video again.",
    });
  }

  try {
    const question_ = String(question);
    const searchedChunks = await session.vectorStore.similaritySearch(question_, 3);
    const llmReply = await chatBot(searchedChunks, question_);
    return res.json({ answer: llmReply });
  } catch (error) {
    console.error("Error answering question:", error);
    return res.status(500).json({
      error: "Failed to generate answer",
      details: error.message,
    });
  }
});

app.post("/api/simple-chat", async (req, res) => {
  const { sessionId, message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const id = sessionId || crypto.randomUUID();
  const history = simpleChatSessions.get(id) || [];

  try {
    const answer = await simpleChat(history, String(message));

    history.push({ role: "user", content: String(message) });
    history.push({ role: "assistant", content: String(answer) });
    simpleChatSessions.set(id, history.slice(-20));

    return res.json({ sessionId: id, answer });
  } catch (error) {
    console.error("Error in simple chat:", error);
    return res.status(500).json({
      error: "Failed to generate answer",
      details: error.message,
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === "Unsupported audio file type." || err.message === "Unsupported document file type.") {
    return res.status(400).json({ error: err.message });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Unexpected server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
