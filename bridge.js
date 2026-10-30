// Relays messages between the page script (main.js) and the extension background (background.js)
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data || !e.data.__asw) return;
  const { __asw, __id, ...data } = e.data;
  try {
    chrome.runtime.sendMessage(data, (resp) => {
      void chrome.runtime.lastError;
      if (__id) window.postMessage({ __aswResp: __id, resp }, "*");
    });
  } catch (err) {
    if (__id) window.postMessage({ __aswResp: __id, resp: null }, "*");
  }
});
