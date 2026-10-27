// ================== Notifications (edit this part only) ==================
// ntfy: your own topic name. Leave "" to disable.
const NTFY_TOPIC = "";

// Pushover (optional, alarm-style alerts). Fill in both to enable.
const PUSHOVER_TOKEN = "";  // API Token of your Pushover application
const PUSHOVER_USER = "";   // Your Pushover User Key
const PUSHOVER_SOUND = "persistent";  // Sound name. Change to "alarm30" after uploading alarm30.mp3

// Healthchecks.io ping URL (optional). Alerts you when the browser is closed, the computer sleeps,
// or the internet is down. Looks like "https://hc-ping.com/xxxxxxxx-xxxx-...". Leave "" to disable.
const HEALTHCHECK_URL = "";

const HEARTBEAT_HOURS = 12;  // Send a "still running" message this often
// =========================================================================

const now = () => Date.now();
const fmt = (t) => new Date(t).toLocaleString("en-US", { hour12: false });
const store = chrome.storage.local;

function notify(title, msg) {
  if (NTFY_TOPIC) {
    fetch("https://ntfy.sh/" + encodeURIComponent(NTFY_TOPIC), {
      method: "POST",
      body: msg,
      headers: { Title: title },
    }).catch((err) => console.log("ntfy failed", err));
  }

  // Only "in stock" triggers Pushover: emergency priority, repeats every 30 s until acknowledged (up to 1 hour)
  if (title === "iPhone in stock" && PUSHOVER_TOKEN && PUSHOVER_USER) {
    const body = new URLSearchParams({
      token: PUSHOVER_TOKEN,
      user: PUSHOVER_USER,
      title: "iPhone in stock!",
      message: msg,
      priority: "2",
      retry: "30",
      expire: "3600",
      sound: PUSHOVER_SOUND,
    });
    fetch("https://api.pushover.net/1/messages.json", { method: "POST", body })
      .then((r) => r.text())
      .then((t) => console.log("pushover", t))
      .catch((err) => console.log("pushover failed", err));
  }
}

// A successful check from the page: update status, send heartbeat, ping Healthchecks
async function onCheckOk(m, tabId) {
  const t = now();
  const st = await store.get(["lastHeartbeat", "stalled"]);
  await store.set({ lastOk: t, interval: m.interval, stores: m.stores, tabId, active: true, stalled: false });

  if (st.stalled) notify("Apple watcher resumed", "Checks are working again.");

  if (!st.lastHeartbeat) {
    await store.set({ lastHeartbeat: t });
  } else if (t - st.lastHeartbeat >= HEARTBEAT_HOURS * 3600 * 1000) {
    notify("Apple watcher still running", `Still working. Last check ${fmt(t)}, ${m.stores} stores.`);
    await store.set({ lastHeartbeat: t });
  }

  if (HEALTHCHECK_URL) fetch(HEALTHCHECK_URL).catch(() => {});
}

chrome.runtime.onMessage.addListener((m, sender) => {
  if (m.kind === "ok") onCheckOk(m, sender.tab && sender.tab.id);
  else if (m.title) notify(m.title, m.msg);
});

// The watched tab was closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const st = await store.get(["tabId", "active"]);
  if (st.active && st.tabId === tabId) {
    notify("Apple watcher stopped", "The Apple buy page tab was closed. Checking has stopped.");
    await store.set({ active: false, stalled: false });
  }
});

// Watchdog: the browser is still running but no successful check for a while
chrome.alarms.get("watchdog", (a) => {
  if (!a) chrome.alarms.create("watchdog", { periodInMinutes: 5 });
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "watchdog") return;
  const st = await store.get(["lastOk", "interval", "active", "stalled"]);
  if (!st.active || st.stalled || !st.lastOk) return;
  const limitMin = (st.interval || 5) * 3 + 5;
  const mins = Math.round((now() - st.lastOk) / 60000);
  if (mins > limitMin) {
    notify("Apple watcher stopped",
      `No successful check for ${mins} minutes. The tab may be asleep or on another page, or Apple is blocking requests.`);
    await store.set({ stalled: true });
  }
});
