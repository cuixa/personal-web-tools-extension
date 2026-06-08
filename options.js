const DIRECTORY_DB = "scroll-anchor-directory";
const DIRECTORY_STORE = "handles";
const DIRECTORY_HANDLE_KEY = "notes-directory";
const status = document.getElementById("status");

document.getElementById("choose-directory").addEventListener("click", chooseDirectory);
document.getElementById("sync-now").addEventListener("click", syncNow);

init();

async function init() {
  const handle = await getDirectoryHandle();

  if (handle) {
    status.textContent = `当前文件夹：${handle.name}`;
  }
}

async function chooseDirectory() {
  if (!("showDirectoryPicker" in window)) {
    status.textContent = "当前 Chrome 环境不支持选择本地文件夹。";
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await saveDirectoryHandle(handle);
    status.textContent = `当前文件夹：${handle.name}`;
    await syncNow();
  } catch (error) {
    status.textContent = error?.name === "AbortError" ? "已取消选择文件夹。" : error.message;
  }
}

async function syncNow() {
  const response = await chrome.runtime.sendMessage({ type: "sync-notes-file" });

  if (response?.ok) {
    status.textContent = `${status.textContent.split("。")[0]}。已写入 web-page-notes.json`;
  } else {
    status.textContent = response?.error === "No notes folder selected"
      ? "尚未选择文件夹。笔记会先保存在 Chrome 扩展本地存储中。"
      : response?.error || "写入文件失败，请重新选择文件夹。";
  }
}

async function saveDirectoryHandle(handle) {
  const db = await openDirectoryDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(DIRECTORY_STORE, "readwrite");
    transaction.objectStore(DIRECTORY_STORE).put(handle, DIRECTORY_HANDLE_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
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
