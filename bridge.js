// Relays messages from the page to the extension background
window.addEventListener("message", (e) => {
  if (e.source === window && e.data && e.data.__asw) {
    const { __asw, ...data } = e.data;
    chrome.runtime.sendMessage(data);
  }
});
