(() => {
  "use strict";


  const tabYoutube = document.getElementById("tab-youtube");
  const tabAudio = document.getElementById("tab-audio");
  const heroSub = document.getElementById("hero-sub");


  const processForm = document.getElementById("process-form");
  const urlInput = document.getElementById("youtube-url");
  const analyzeBtn = document.getElementById("analyze-btn");


  const audioForm = document.getElementById("audio-form");
  const audioFileInput = document.getElementById("audio-file");
  const fileSlot = document.getElementById("file-slot");
  const fileNameEl = document.getElementById("file-name");
  const languageSelect = document.getElementById("audio-language");
  const analyzeAudioBtn = document.getElementById("analyze-audio-btn");

  const formError = document.getElementById("form-error");

 
  const pipelineSection = document.getElementById("pipeline");
  const pipelineFill = document.getElementById("pipeline-fill");
  const pipelineStatus = document.getElementById("pipeline-status");
  const stopEls = Array.from(document.querySelectorAll(".stop"));
  const fetchStopMain = document.querySelector('[data-stop="fetch"] .stop-main');
  const fetchStopSub = document.querySelector('[data-stop="fetch"] .stop-sub');


  const summaryPanel = document.getElementById("summary-panel");
  const summaryBody = document.getElementById("summary-body");
  const videoIdTag = document.getElementById("video-id-tag");

  const chatPanel = document.getElementById("chat-panel");
  const chatLog = document.getElementById("chat-log");
  const chatHint = document.getElementById("chat-hint");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-question");

  const STEPS = ["fetch", "convert", "transcribe", "summarize", "index"];

  const HERO_COPY = {
    youtube:
      "Drop in a YouTube URL. It's pulled apart into audio, spoken into text, boiled down to a summary, and indexed so you can ask it questions directly.",
    audio:
      "Upload a recording — a meeting, a call, a lecture. It's transcribed, boiled down into highlights and action items, and indexed so you can ask it questions directly.",
  };

  let currentMode = "youtube";
  let pipelineSettled = false;
  let currentVideoId = null;

  function estimatedMsFor(mode) {
    return {
      fetch: mode === "audio" ? 3000 : 6000,
      convert: 2500,
      transcribe: 22000,
      summarize: 9000,
      index: 3500,
    };
  }

  function labelsFor(mode) {
    return {
      fetch: mode === "audio" ? "Uploading & reading audio…" : "Fetching audio…",
      convert: "Converting to 16kHz mono…",
      transcribe: "Transcribing speech…",
      summarize:
        mode === "audio" ? "Extracting highlights & action items…" : "Summarizing key points…",
      index: "Indexing for Q&A…",
    };
  }

 
  function setMode(mode) {
    currentMode = mode;
    tabYoutube.classList.toggle("active", mode === "youtube");
    tabAudio.classList.toggle("active", mode === "audio");
    tabYoutube.setAttribute("aria-selected", String(mode === "youtube"));
    tabAudio.setAttribute("aria-selected", String(mode === "audio"));
    processForm.hidden = mode !== "youtube";
    audioForm.hidden = mode !== "audio";
    formError.hidden = true;
    heroSub.textContent = HERO_COPY[mode];

    fetchStopMain.textContent = mode === "audio" ? "Upload" : "Fetch";
    fetchStopSub.textContent = mode === "audio" ? "reading file" : "pulling audio";
  }

  tabYoutube.addEventListener("click", () => setMode("youtube"));
  tabAudio.addEventListener("click", () => setMode("audio"));

  audioFileInput.addEventListener("change", () => {
    const file = audioFileInput.files[0];
    fileSlot.classList.toggle("has-file", !!file);
    fileNameEl.textContent = file ? file.name : "No file chosen — meeting, call, or any recording";
  });


  function sleep(ms) {
    const tick = 150;
    let elapsed = 0;
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        elapsed += tick;
        if (pipelineSettled || elapsed >= ms) {
          clearInterval(timer);
          resolve();
        }
      }, tick);
    });
  }

  function setActiveStep(i, mode) {
    stopEls.forEach((el, idx) => {
      el.classList.toggle("done", idx < i);
      el.classList.toggle("active", idx === i);
    });
    pipelineFill.style.width = `${(i / (STEPS.length - 1)) * 100}%`;
    pipelineStatus.textContent = labelsFor(mode)[STEPS[i]];
    pipelineStatus.style.color = "";
  }

  function resetStops() {
    stopEls.forEach((el) => el.classList.remove("done", "active"));
    pipelineFill.style.width = "0%";
  }

  function completePipeline(success, message) {
    if (success) {
      stopEls.forEach((el) => el.classList.add("done"));
      stopEls.forEach((el) => el.classList.remove("active"));
      pipelineFill.style.width = "100%";
      pipelineStatus.textContent = message || "Ready.";
    } else {
      pipelineStatus.textContent = message || "Something went wrong.";
      pipelineStatus.style.color = "var(--red)";
    }
  }

  async function runPipelineAnimation(mode) {
    const estimated = estimatedMsFor(mode);
    for (let i = 0; i < STEPS.length; i++) {
      if (pipelineSettled) return;
      setActiveStep(i, mode);
      await sleep(estimated[STEPS[i]]);
    }
    while (!pipelineSettled) {
      await sleep(400);
    }
  }

 
  function renderSummary(text) {
    summaryBody.innerHTML = "";
    if (!text) {
      const p = document.createElement("p");
      p.textContent = "No summary was returned.";
      summaryBody.appendChild(p);
      return;
    }

    const lines = String(text).split("\n").map((l) => l.trim()).filter(Boolean);
    const bulletPattern = /^([-*•]|\d+[.)])\s+/;
    const bulletLines = lines.filter((l) => bulletPattern.test(l));

    if (bulletLines.length >= 2) {
      const ul = document.createElement("ul");
      lines.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line.replace(bulletPattern, "");
        ul.appendChild(li);
      });
      summaryBody.appendChild(ul);
    } else {
      lines.forEach((line) => {
        const p = document.createElement("p");
        p.textContent = line;
        summaryBody.appendChild(p);
      });
    }
  }


  async function runProcess(mode, requestFn, submitBtn) {
    formError.hidden = true;
    submitBtn.disabled = true;
    summaryPanel.hidden = true;
    chatPanel.hidden = true;
    pipelineSection.hidden = false;
    pipelineSettled = false;
    resetStops();

    runPipelineAnimation(mode);

    try {
      const res = await requestFn();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process.");

      currentVideoId = data.videoId;
      pipelineSettled = true;
      completePipeline(true, `Ready — indexed as ${data.videoId}`);

      renderSummary(data.summary);
      videoIdTag.textContent = data.videoId;
      summaryPanel.hidden = false;
      chatPanel.hidden = false;
      chatInput.focus();
    } catch (err) {
      pipelineSettled = true;
      completePipeline(false, err.message);
      formError.textContent = err.message;
      formError.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  }

  processForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const youtubeUrl = urlInput.value.trim();
    if (!youtubeUrl) return;

    runProcess(
      "youtube",
      () =>
        fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtubeUrl }),
        }),
      analyzeBtn
    );
  });

  audioForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const file = audioFileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("language", languageSelect.value);

    runProcess(
      "audio",
      () =>
        fetch("/api/process-audio", {
          method: "POST",
          body: formData,
        }),
      analyzeAudioBtn
    );
  });


  function appendMessage(role, text) {
    if (chatHint) chatHint.remove();
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}`;

    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.textContent = role === "user" ? "YOU" : role === "error" ? "ERROR" : "REEL";

    const body = document.createElement("div");
    body.className = "msg-body";
    body.textContent = text;

    wrap.appendChild(meta);
    wrap.appendChild(body);
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
    return { wrap, body };
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = chatInput.value.trim();
    if (!question || !currentVideoId) return;

    appendMessage("user", question);
    chatInput.value = "";
    chatInput.disabled = true;

    const pending = appendMessage("assistant", "Thinking…");
    pending.wrap.classList.add("pending");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: currentVideoId, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not get an answer.");
      pending.wrap.classList.remove("pending");
      pending.body.textContent = data.answer;
    } catch (err) {
      pending.wrap.classList.remove("pending");
      pending.wrap.classList.add("error");
      pending.body.textContent = err.message;
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  });
})();
