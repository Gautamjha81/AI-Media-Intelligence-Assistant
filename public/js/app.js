(() => {
  "use strict";

  const views = Array.from(document.querySelectorAll(".view"));

  function showView(name) {
    views.forEach((v) => {
      v.hidden = v.id !== `view-${name}`;
    });
  }

  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.getAttribute("data-view")));
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showView("home"));
  });

  const STEPS = ["fetch", "convert", "transcribe", "summarize", "index"];

  function sleep(ms, isSettled) {
    const tick = 150;
    let elapsed = 0;
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        elapsed += tick;
        if (isSettled() || elapsed >= ms) {
          clearInterval(timer);
          resolve();
        }
      }, tick);
    });
  }

  function renderSummary(container, text) {
    container.innerHTML = "";
    if (!text) {
      const p = document.createElement("p");
      p.textContent = "No summary was returned.";
      container.appendChild(p);
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
      container.appendChild(ul);
    } else {
      lines.forEach((line) => {
        const p = document.createElement("p");
        p.textContent = line;
        container.appendChild(p);
      });
    }
  }

  function appendMessage(logEl, hintEl, role, text) {
    if (hintEl && hintEl.parentNode) hintEl.remove();
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
    logEl.appendChild(wrap);
    logEl.scrollTop = logEl.scrollHeight;
    return { wrap, body };
  }

  function wireChat(prefix, getSessionId) {
    const logEl = document.getElementById(`${prefix}-chat-log`);
    const hintEl = document.getElementById(`${prefix}-chat-hint`);
    const formEl = document.getElementById(`${prefix}-chat-form`);
    const inputEl = document.getElementById(`${prefix}-chat-question`);

    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const question = inputEl.value.trim();
      const sessionId = getSessionId();
      if (!question || !sessionId) return;

      appendMessage(logEl, hintEl, "user", question);
      inputEl.value = "";
      inputEl.disabled = true;

      const pending = appendMessage(logEl, null, "assistant", "Thinking…");
      pending.wrap.classList.add("pending");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: sessionId, question }),
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
        inputEl.disabled = false;
        inputEl.focus();
      }
    });
  }

  function wireProcessFeature(config) {
    const {
      prefix,
      formEl,
      submitBtn,
      estimatedMs,
      labels,
      buildRequest,
      onSuccess,
    } = config;

    const formError = document.getElementById(`${prefix}-form-error`);
    const pipelineSection = document.getElementById(`${prefix}-pipeline`);
    const pipelineFill = document.getElementById(`${prefix}-pipeline-fill`);
    const pipelineStatus = document.getElementById(`${prefix}-pipeline-status`);
    const stopEls = Array.from(pipelineSection.querySelectorAll(".stop"));

    const summaryPanel = document.getElementById(`${prefix}-summary-panel`);
    const summaryBody = document.getElementById(`${prefix}-summary-body`);
    const idTag = document.getElementById(`${prefix}-id-tag`);
    const chatPanel = document.getElementById(`${prefix}-chat-panel`);
    const chatInput = document.getElementById(`${prefix}-chat-question`);

    let pipelineSettled = false;
    let sessionId = null;

    function setActiveStep(i) {
      stopEls.forEach((el, idx) => {
        el.classList.toggle("done", idx < i);
        el.classList.toggle("active", idx === i);
      });
      pipelineFill.style.width = `${(i / (STEPS.length - 1)) * 100}%`;
      pipelineStatus.textContent = labels[STEPS[i]];
      pipelineStatus.style.color = "";
    }

    function resetStops() {
      stopEls.forEach((el) => el.classList.remove("done", "active"));
      pipelineFill.style.width = "0%";
    }

    function completePipeline(success, message, tone) {
      if (success) {
        stopEls.forEach((el) => el.classList.add("done"));
        stopEls.forEach((el) => el.classList.remove("active"));
        pipelineFill.style.width = "100%";
        pipelineStatus.textContent = message || "Ready.";
      } else {
        pipelineStatus.textContent = message || "Something went wrong.";
        pipelineStatus.style.color = tone === "notice" ? "var(--amber)" : "var(--red)";
      }
    }

    async function runPipelineAnimation() {
      for (let i = 0; i < STEPS.length; i++) {
        if (pipelineSettled) return;
        setActiveStep(i);
        await sleep(estimatedMs[STEPS[i]], () => pipelineSettled);
      }
      while (!pipelineSettled) {
        await sleep(400, () => pipelineSettled);
      }
    }

    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();

      formError.hidden = true;
      submitBtn.disabled = true;
      summaryPanel.hidden = true;
      chatPanel.hidden = true;
      pipelineSection.hidden = false;
      pipelineSettled = false;
      resetStops();

      runPipelineAnimation();

      try {
        const res = await buildRequest();
        const data = await res.json();
        if (!res.ok) {
          const err = new Error(data.error || "Failed to process.");
          err.code = data.code;
          throw err;
        }

        sessionId = data.videoId;
        pipelineSettled = true;
        completePipeline(true, `Ready — indexed as ${data.videoId}`);

        renderSummary(summaryBody, data.summary);
        idTag.textContent = data.videoId;
        summaryPanel.hidden = false;
        chatPanel.hidden = false;
        chatInput.focus();

        if (onSuccess) onSuccess(data);
      } catch (err) {
        pipelineSettled = true;

        if (err.code === "YOUTUBE_BOT_CHECK") {
          completePipeline(false, "YouTube is blocking automated downloads right now.", "notice");
          formError.textContent = err.message;
          formError.className = "form-notice";
          formError.hidden = false;
        } else {
          completePipeline(false, err.message);
          formError.textContent = err.message;
          formError.className = "form-error";
          formError.hidden = false;
        }
      } finally {
        submitBtn.disabled = false;
      }
    });

    wireChat(prefix, () => sessionId);
  }

  const audioFileInput = document.getElementById("audio-file");
  const audioFileSlot = document.getElementById("audio-file-slot");
  const audioFileName = document.getElementById("audio-file-name");

  audioFileInput.addEventListener("change", () => {
    const file = audioFileInput.files[0];
    audioFileSlot.classList.toggle("has-file", !!file);
    audioFileName.textContent = file ? file.name : "No file chosen — meeting, call, or any recording";
  });

  wireProcessFeature({
    prefix: "audio",
    formEl: document.getElementById("audio-form"),
    submitBtn: document.getElementById("audio-analyze-btn"),
    estimatedMs: { fetch: 3000, convert: 2500, transcribe: 22000, summarize: 9000, index: 3500 },
    labels: {
      fetch: "Uploading & reading audio…",
      convert: "Converting to 16kHz mono…",
      transcribe: "Transcribing speech…",
      summarize: "Extracting highlights & action items…",
      index: "Indexing for Q&A…",
    },
    buildRequest: () => {
      const file = audioFileInput.files[0];
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("language", document.getElementById("audio-language").value);
      return fetch("/api/process-audio", { method: "POST", body: formData });
    },
  });

  const documentFileInput = document.getElementById("document-file");
  const documentFileSlot = document.getElementById("document-file-slot");
  const documentFileName = document.getElementById("document-file-name");

  documentFileInput.addEventListener("change", () => {
    const file = documentFileInput.files[0];
    documentFileSlot.classList.toggle("has-file", !!file);
    documentFileName.textContent = file ? file.name : "No file chosen — PDF, DOCX, or TXT";
  });

  const documentContentPanel = document.getElementById("document-content-panel");
  const documentContentToggle = document.getElementById("document-content-toggle");
  const documentPageList = document.getElementById("document-page-list");
  const documentPageCount = document.getElementById("document-page-count");

  documentContentToggle.addEventListener("click", () => {
    documentPageList.hidden = !documentPageList.hidden;
  });

  function renderDocumentPages(pages) {
    documentPageList.innerHTML = "";
    (pages || []).forEach((page) => {
      const item = document.createElement("div");
      item.className = "page-item";

      const head = document.createElement("button");
      head.type = "button";
      head.className = "page-item-head";
      head.textContent = `Page ${page.page}`;

      const body = document.createElement("div");
      body.className = "page-item-body";
      body.textContent = page.text || "(empty)";
      body.hidden = true;

      head.addEventListener("click", () => {
        body.hidden = !body.hidden;
      });

      item.appendChild(head);
      item.appendChild(body);
      documentPageList.appendChild(item);
    });

    documentPageCount.textContent = `${(pages || []).length} page(s)`;
  }

  wireProcessFeature({
    prefix: "document",
    formEl: document.getElementById("document-form"),
    submitBtn: document.getElementById("document-analyze-btn"),
    estimatedMs: { fetch: 2000, convert: 4000, transcribe: 2500, summarize: 9000, index: 3000 },
    labels: {
      fetch: "Uploading & reading document…",
      convert: "Extracting text…",
      transcribe: "Structuring pages…",
      summarize: "Summarizing key points…",
      index: "Indexing for Q&A…",
    },
    buildRequest: () => {
      const file = documentFileInput.files[0];
      const formData = new FormData();
      formData.append("document", file);
      return fetch("/api/process-document", { method: "POST", body: formData });
    },
    onSuccess: (data) => {
      documentContentPanel.hidden = false;
      documentPageList.hidden = true;
      renderDocumentPages(data.pages);
    },
  });

  wireProcessFeature({
    prefix: "youtube",
    formEl: document.getElementById("youtube-form"),
    submitBtn: document.getElementById("youtube-analyze-btn"),
    estimatedMs: { fetch: 6000, convert: 2500, transcribe: 22000, summarize: 9000, index: 3500 },
    labels: {
      fetch: "Fetching audio…",
      convert: "Converting to 16kHz mono…",
      transcribe: "Transcribing speech…",
      summarize: "Summarizing key points…",
      index: "Indexing for Q&A…",
    },
    buildRequest: () => {
      const youtubeUrl = document.getElementById("youtube-url").value.trim();
      return fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl,
          language: document.getElementById("youtube-language").value,
        }),
      });
    },
  });

  const chatbotLog = document.getElementById("chatbot-chat-log");
  const chatbotHint = document.getElementById("chatbot-chat-hint");
  const chatbotForm = document.getElementById("chatbot-chat-form");
  const chatbotInput = document.getElementById("chatbot-chat-question");
  let chatbotSessionId = null;

  chatbotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = chatbotInput.value.trim();
    if (!message) return;

    appendMessage(chatbotLog, chatbotHint, "user", message);
    chatbotInput.value = "";
    chatbotInput.disabled = true;

    const pending = appendMessage(chatbotLog, null, "assistant", "Thinking…");
    pending.wrap.classList.add("pending");

    try {
      const res = await fetch("/api/simple-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: chatbotSessionId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not get an answer.");
      chatbotSessionId = data.sessionId;
      pending.wrap.classList.remove("pending");
      pending.body.textContent = data.answer;
    } catch (err) {
      pending.wrap.classList.remove("pending");
      pending.wrap.classList.add("error");
      pending.body.textContent = err.message;
    } finally {
      chatbotInput.disabled = false;
      chatbotInput.focus();
    }
  });

  showView("home");
})();
