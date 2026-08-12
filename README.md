# Reel — Video Intelligence Console

An Express server wired around your existing pipeline (YouTube → audio →
transcript → summary → RAG chat), with a small frontend on top. Nothing in
`utils/` or `chat.js` was changed — only imported.

## Structure

```
.
├── server.js                 # NEW — Express app, only file with routing logic
├── package.json               # NEW
├── .env.example                # NEW
├── chat.js                     # unchanged (your chatBot)
├── utils/                      # unchanged (your pipeline logic)
│   ├── youtubeExtraction/      #   download → convert → chunk → transcribe
│   ├── summary/                #   textSummary → initial/final summary
│   └── ragPipeline/            #   splitter → vector store
└── public/                     # NEW — frontend
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Run it

```bash
npm install
cp .env.example .env   # fill in OPENAI_API_KEY
npm start
```

Open `http://localhost:3000`.

## API surface

`server.js` just calls your existing functions in order and exposes three
routes — it doesn't reimplement any of the pipeline:

- **POST `/api/process`** — body `{ youtubeUrl }`
  Runs `extractAudio → textSummary("youtube") → ragFunction`, exactly as
  `server.js`'s old `main()` did. Keeps the resulting vector store in
  memory for 10 minutes (matching the TTL already built into
  `vectorStore.js`), keyed by a `videoId` derived from the URL. Returns
  `{ videoId, summary }`.

- **POST `/api/process-audio`** — multipart form, field `audio` (the file)
  and optional field `language` (`english` default, or `hindi` to route
  through Whisper's translation endpoint instead of transcription — same
  branching `transcribe.js` already had). Skips the YouTube download step
  and instead runs `convertTo16kHz → chunkAudio → transcribe →
  textSummary("meeting") → ragFunction` directly on the uploaded file —
  the same generic functions `extractAudio.js` calls internally, just
  without `downloadYoutubeAudio`. Returns `{ videoId, summary }`, where
  `summary` is now the meeting-style highlights (decisions, action items,
  owners, deadlines, unresolved questions). Uploaded/intermediate files are
  deleted from `utils/uploads` after processing. Accepts
  `.mp3/.wav/.m4a/.webm/.ogg/.mp4/.flac`, up to 200MB.

- **POST `/api/chat`** — body `{ videoId, question }`
  Looks up the stored vector store (from either flow above), runs
  `similaritySearch` then your `chatBot`, exactly as the old `main()` did.
  Returns `{ answer }`.

## Frontend

- A single form takes the YouTube URL and posts to `/api/process`. Because
  that call is one long blocking request server-side, the "pipeline" bar
  (Fetch → Convert → Transcribe → Summarize → Index) is a *paced client-side
  animation*, not a real progress stream — it steps forward on a timer and
  snaps to "done" the moment the real response arrives (or reports the
  error if it fails). If you want genuine live progress later, that needs
  the backend to emit status events (e.g. Server-Sent Events) — no such
  hook exists in the current pipeline code, so nothing was added.
- Once `/api/process` resolves, the summary renders and a chat console
  unlocks, which just calls `/api/chat` with the returned `videoId`.

## Change made to backend logic (by request)

`utils/summary/textSummary.js` previously imported `initialSummary`/
`finalSummary` from `./youtube/...` for **both** branches, so the
`utils/summary/meeting/` versions were dead code. Since you confirmed it,
the non-`"youtube"` branch now imports and calls
`initialSummary`/`finalSummary` from `./meeting/...` instead, so uploaded
audio (`textFrom: "meeting"`) actually gets decisions/action
items/owners/deadlines-style highlights. That's the only line changed in
`utils/`; everything else in there is untouched.
