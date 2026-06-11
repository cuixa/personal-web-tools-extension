const DIRECTORY_DB = "scroll-anchor-directory";
const DIRECTORY_STORE = "handles";
const DIRECTORY_HANDLE_KEY = "notes-directory";
const NOTES_FILE = "web-page-notes.json";
const status = document.getElementById("status");

document.getElementById("choose-directory").addEventListener("click", chooseDirectory);
document.getElementById("sync-now").addEventListener("click", syncNow);

init();

async function init() {
  const handle = await getDirectoryHandle();

  if (handle) {
    await showDirectoryStatus(handle);
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
    await showDirectoryStatus(handle);
    await syncNow();
  } catch (error) {
    status.textContent = error?.name === "AbortError" ? "已取消选择文件夹。" : error.message;
  }
}

async function syncNow() {
  const handle = await getDirectoryHandle();

  if (!handle) {
    status.textContent = "尚未选择文件夹。笔记会先保存在 Chrome 扩展本地存储中。";
    return;
  }

  const permission = await verifyPermission(handle, true);

  if (!permission) {
    status.textContent = `已记住文件夹：${handle.name}。尚未获得写入权限，请点击“授权并写入文件”重新授权。`;
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: "sync-notes-file" });

  if (response?.ok) {
    status.textContent = `当前文件夹：${handle.name}。已写入 ${NOTES_FILE}`;
  } else {
    status.textContent = response?.error === "No notes folder selected"
      ? "尚未选择文件夹。笔记会先保存在 Chrome 扩展本地存储中。"
      : response?.error || "写入文件失败，请重新选择文件夹。";
  }
}

async function showDirectoryStatus(handle) {
  const permissionState = await queryPermissionState(handle, true);

  if (permissionState === "granted") {
    status.textContent = `当前文件夹：${handle.name}。写入权限有效`;
    return;
  }

  status.textContent = `已记住文件夹：${handle.name}。需要点击“授权并写入文件”恢复写入权限`;
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

async function verifyPermission(handle, write) {
  if (!handle.queryPermission || !handle.requestPermission) {
    return false;
  }

  const options = { mode: write ? "readwrite" : "read" };

  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }

  return (await handle.requestPermission(options)) === "granted";
}

async function queryPermissionState(handle, write) {
  if (!handle.queryPermission) {
    return "denied";
  }

  return await handle.queryPermission({ mode: write ? "readwrite" : "read" });
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
