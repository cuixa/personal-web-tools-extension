(() => {
  const ANCHOR_PREFIX = "scroll-anchor:";
  const NOTE_LAYER_ID = "scroll-anchor-note-layer";
  const STYLE_ID = "scroll-anchor-style";

  let notes = [];
  let placementMode = false;
  let toastTimer;

  function getPageKey() {
    return `${location.origin}${location.pathname}${location.search}`;
  }

  function getAnchorKey() {
    return `${ANCHOR_PREFIX}${getPageKey()}`;
  }

  function readAnchorState() {
    try {
      return JSON.parse(sessionStorage.getItem(getAnchorKey())) || {};
    } catch {
      return {};
    }
  }

  function writeAnchorState(nextState) {
    sessionStorage.setItem(getAnchorKey(), JSON.stringify(nextState));
  }

  function getScrollTop() {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function maxScrollTop() {
    return Math.max(
      0,
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    ) - window.innerHeight;
  }

  function scrollToPosition(top) {
    window.scrollTo({
      top: Math.min(Math.max(0, top), maxScrollTop()),
      behavior: "smooth"
    });
  }

  function showToast(message) {
    let toast = document.getElementById("scroll-anchor-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "scroll-anchor-toast";
      toast.setAttribute("role", "status");
      toast.style.cssText = [
        "position:fixed",
        "right:18px",
        "bottom:18px",
        "z-index:2147483647",
        "max-width:300px",
        "padding:10px 12px",
        "border-radius:8px",
        "background:rgba(18,18,18,.92)",
        "color:#fff",
        "font:13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
        "box-shadow:0 8px 24px rgba(0,0,0,.22)",
        "opacity:0",
        "transform:translateY(8px)",
        "transition:opacity .16s ease,transform .16s ease",
        "pointer-events:none"
      ].join(";");
      document.documentElement.appendChild(toast);
    }

    toast.textContent = message;
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
    }, 1800);
  }

  function setAnchor() {
    const state = readAnchorState();
    state.anchorTop = getScrollTop();
    state.anchorSetAt = Date.now();
    writeAnchorState(state);
    showToast("Anchor saved");
  }

  function goAnchor() {
    const state = readAnchorState();

    if (typeof state.anchorTop !== "number") {
      showToast("No anchor yet: press Alt+Shift+A");
      return;
    }

    state.returnTop = getScrollTop();
    writeAnchorState(state);
    scrollToPosition(state.anchorTop);
    showToast("Jumped to anchor");
  }

  function returnBeforeAnchor() {
    const state = readAnchorState();

    if (typeof state.returnTop !== "number") {
      showToast("No return position yet");
      return;
    }

    const currentTop = getScrollTop();
    scrollToPosition(state.returnTop);
    state.returnTop = currentTop;
    writeAnchorState(state);
    showToast("Returned to previous position");
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${NOTE_LAYER_ID} {
        position: absolute;
        inset: 0 auto auto 0;
        z-index: 2147483646;
        pointer-events: none;
      }
      .scroll-anchor-note {
        position: absolute;
        width: 220px;
        min-height: 72px;
        padding: 10px;
        border: 1px solid #d7b95b;
        border-radius: 8px;
        color: #1f1f1f;
        background: #fff8cf;
        box-shadow: 0 10px 24px rgba(0, 0, 0, .16);
        font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: auto;
        white-space: pre-wrap;
      }
      .scroll-anchor-note-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        margin-top: 8px;
      }
      .scroll-anchor-note button,
      .scroll-anchor-editor button {
        min-height: 26px;
        border: 1px solid #c8aa49;
        border-radius: 6px;
        color: #1f1f1f;
        background: #fff1a8;
        font: 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }
      .scroll-anchor-editor {
        position: absolute;
        z-index: 2147483647;
        width: 260px;
        padding: 10px;
        border: 1px solid #8c8c8c;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 12px 30px rgba(0, 0, 0, .22);
        pointer-events: auto;
      }
      .scroll-anchor-editor textarea {
        box-sizing: border-box;
        width: 100%;
        min-height: 96px;
        resize: vertical;
        border: 1px solid #cfcfcf;
        border-radius: 6px;
        padding: 8px;
        color: #171717;
        background: #fff;
        font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .scroll-anchor-editor-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 8px;
      }
      html.scroll-anchor-placement-mode,
      html.scroll-anchor-placement-mode * {
        cursor: crosshair !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function ensureLayer() {
    ensureStyles();
    let layer = document.getElementById(NOTE_LAYER_ID);

    if (!layer) {
      layer = document.createElement("div");
      layer.id = NOTE_LAYER_ID;
      document.documentElement.appendChild(layer);
    }

    return layer;
  }

  async function loadNotes() {
    const response = await chrome.runtime.sendMessage({
      type: "get-notes",
      pageKey: getPageKey()
    });
    notes = response?.notes || [];
    renderNotes();
  }

  async function persistNotes() {
    const response = await chrome.runtime.sendMessage({
      type: "save-notes",
      pageKey: getPageKey(),
      notes
    });

    await notifyMirrorFailure(response?.mirror);
  }

  async function notifyMirrorFailure(mirror) {
    if (!mirror || mirror.ok) {
      return;
    }

    let message = "";

    if (mirror.error === "No notes folder selected") {
      message = "网页笔记已保存到扩展本地存储，但尚未选择文件保存文件夹。是否打开设置页选择文件夹？";
    } else if (mirror.error === "No write permission for selected folder") {
      message = "网页笔记已保存到扩展本地存储，但当前没有保存文件夹的写入权限，尚未同步到 web-page-notes.json。是否打开设置页重新授权？";
    } else {
      message = `网页笔记已保存到扩展本地存储，但写入 web-page-notes.json 失败：${mirror.error}。是否打开设置页检查？`;
    }

    if (window.confirm(message)) {
      await chrome.runtime.sendMessage({ type: "open-options" });
    }
  }

  function renderNotes() {
    const layer = ensureLayer();
    layer.querySelectorAll(".scroll-anchor-note,.scroll-anchor-editor").forEach((node) => node.remove());

    for (const note of notes) {
      const card = document.createElement("article");
      card.className = "scroll-anchor-note";
      card.style.left = `${Math.max(8, note.x)}px`;
      card.style.top = `${Math.max(8, note.y)}px`;
      card.dataset.noteId = note.id;

      const text = document.createElement("div");
      text.textContent = note.text;

      const actions = document.createElement("div");
      actions.className = "scroll-anchor-note-actions";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "编辑";
      edit.addEventListener("click", () => openEditor(note.x, note.y, note));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "删除";
      remove.addEventListener("click", async () => {
        notes = notes.filter((item) => item.id !== note.id);
        await persistNotes();
        renderNotes();
      });

      actions.append(edit, remove);
      card.append(text, actions);
      layer.appendChild(card);
    }
  }

  function startNotePlacement() {
    placementMode = true;
    document.documentElement.classList.add("scroll-anchor-placement-mode");
    showToast("Click anywhere on the page to place a note");
  }

  function stopNotePlacement() {
    placementMode = false;
    document.documentElement.classList.remove("scroll-anchor-placement-mode");
  }

  function openEditor(x, y, existingNote) {
    const layer = ensureLayer();
    layer.querySelectorAll(".scroll-anchor-editor").forEach((node) => node.remove());

    const editor = document.createElement("section");
    editor.className = "scroll-anchor-editor";
    editor.style.left = `${Math.min(Math.max(8, x), document.documentElement.scrollWidth - 280)}px`;
    editor.style.top = `${Math.max(8, y)}px`;

    const textarea = document.createElement("textarea");
    textarea.placeholder = "写下这处网页笔记...";
    textarea.value = existingNote?.text || "";

    const actions = document.createElement("div");
    actions.className = "scroll-anchor-editor-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    cancel.addEventListener("click", () => editor.remove());

    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "保存";
    save.addEventListener("click", async () => {
      const text = textarea.value.trim();

      if (!text) {
        showToast("Note is empty");
        return;
      }

      if (existingNote) {
        existingNote.text = text;
        existingNote.updatedAt = new Date().toISOString();
      } else {
        notes.push({
          id: crypto.randomUUID(),
          text,
          x,
          y,
          href: location.href,
          title: document.title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      await persistNotes();
      renderNotes();
      showToast("Note saved");
    });

    actions.append(cancel, save);
    editor.append(textarea, actions);
    layer.appendChild(editor);
    textarea.focus();
  }

  function onPlacementClick(event) {
    if (!placementMode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    stopNotePlacement();
    openEditor(event.pageX, event.pageY);
  }

  if (!globalThis.__scrollAnchorInstalled) {
    globalThis.__scrollAnchorInstalled = true;

    document.addEventListener("click", onPlacementClick, true);

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "set-anchor") {
        setAnchor();
      }

      if (message?.type === "go-anchor") {
        goAnchor();
      }

      if (message?.type === "return-before-anchor") {
        returnBeforeAnchor();
      }

      if (message?.type === "add-note") {
        startNotePlacement();
      }
    });

    loadNotes().catch(() => {
      showToast("Could not load notes on this page");
    });
  }
})();
