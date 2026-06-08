document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({
      type: "popup-command",
      command: button.dataset.command
    });
    window.close();
  });
});

document.getElementById("open-options").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "open-options" });
  window.close();
});
