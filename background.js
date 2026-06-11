const DIRECTORY_DB = "scroll-anchor-directory";
const DIRECTORY_STORE = "handles";
const DIRECTORY_HANDLE_KEY = "notes-directory";
const NOTES_FILE = "web-page-notes.json";

chrome.commands.onCommand.addListener(async (command) => {
  await sendCommandToActiveTab(command);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleMessage(message) {
  if (message?.type === "popup-command") {
    await sendCommandToActiveTab(message.command);
    return { ok: true };
  }

  if (message?.type === "open-options") {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }

  if (message?.type === "get-notes") {
    const result = await safeReadNotesFromDirectory();
    if (!result.ok) {
      return result;
    }
    return { ok: true, notes: result.notes[message.pageKey] || [] };
  }

  if (message?.type === "save-notes") {
    const result = await safeReadNotesFromDirectory();
    if (!result.ok) {
      return result;
    }
    const notes = result.notes;
    notes[message.pageKey] = message.notes;
    return await safeWriteNotesToDirectory(notes);
  }

  if (message?.type === "sync-notes-file") {
    const result = await safeReadNotesFromDirectory();
    if (!result.ok) {
      return result;
    }
    if (result.missing) {
      return await safeWriteNotesToDirectory(result.notes);
    }

    return { ok: true };
  }

  if (message?.type === "get-save-status") {
    const directoryHandle = await getDirectoryHandle();
    return { ok: true, directoryName: directoryHandle?.name || null };
  }

  return { ok: false, error: "Unknown message" };
}

async function safeReadNotesFromDirectory() {
  try {
    return await readNotesFromDirectory();
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function safeWriteNotesToDirectory(notes) {
  try {
    return await writeNotesToDirectory(notes);
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function sendCommandToActiveTab(command) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return;
  }

  await sendMessageToTab(tab.id, { type: command });
}

async function sendMessageToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
      await chrome.tabs.sendMessage(tabId, message);
    } catch {
      // Content scripts cannot run on Chrome internal pages, PDF viewer pages,
      // extension stores, or restricted pages.
    }
  }
}

async function readNotesFromDirectory() {
  const directoryHandle = await getDirectoryHandle();

  if (!directoryHandle) {
    return { ok: false, error: "No notes folder selected" };
  }

  const permission = await hasPermission(directoryHandle, true);

  if (!permission) {
    return { ok: false, error: "No write permission for selected folder" };
  }

  let fileHandle;
  try {
    fileHandle = await directoryHandle.getFileHandle(NOTES_FILE);
  } catch (error) {
    if (error.name === "NotFoundError") {
      return { ok: true, notes: {}, missing: true };
    }
    throw error;
  }

  const file = await fileHandle.getFile();
  const text = await file.text();

  if (!text.trim()) {
    return { ok: true, notes: {}, missing: false };
  }

  const data = JSON.parse(text);
  return { ok: true, notes: data.notes || {}, missing: false };
}

async function writeNotesToDirectory(notes) {
  const directoryHandle = await getDirectoryHandle();

  if (!directoryHandle) {
    return { ok: false, error: "No notes folder selected" };
  }

  const permission = await hasPermission(directoryHandle, true);

  if (!permission) {
    return { ok: false, error: "No write permission for selected folder" };
  }

  const fileHandle = await directoryHandle.getFileHandle(NOTES_FILE, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    notes
  }, null, 2));
  await writable.close();
  return { ok: true, fileName: NOTES_FILE };
}

async function getDirectoryHandle() {
  const db = await openDirectoryDb();
  return await new Promise((resolve, reject) => {
    const transaction = db.transaction(DIRECTORY_STORE, "readonly");
    const request = transaction.objectStore(DIRECTORY_STORE).get(DIRECTORY_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function hasPermission(handle, write) {
  if (!handle.queryPermission || !handle.requestPermission) {
    return false;
  }

  const options = { mode: write ? "readwrite" : "read" };

  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }

  return false;
}

function openDirectoryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DIRECTORY_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DIRECTORY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
