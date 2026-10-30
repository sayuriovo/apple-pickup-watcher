(() => {
  // ================== Settings (edit this part only) ==================
  // Part numbers to watch (one or more). See README, Step 2.
  const PARTS = ["MK1E4LL/A", "MK1F4LL/A"];   // Example: iPhone Duo 256GB Star White, Night Sky

  // Search centers. Apple returns the 12 nearest stores for each center; results are merged.
  // Use either { location: "ZIP code" } or { store: "store ID" }.
  const CENTERS = [{ location: "10001" }];   // Example: New York NY. One center = one request per check.

  const CPPART = "UNLOCKED/US";  // Unlocked version. Usually leave as is.
  const INTERVAL_MIN = 10;       // Average minutes between checks. Keep it at 5 or higher to avoid being blocked.
  const JITTER = 0.3;            // Randomize each wait by up to ±30% so checks don't follow a fixed pattern.
  const RELOAD_MIN = 60;         // Average minutes between page reloads.
  const RELOAD_MIN_FALLBACK = 20; // Page reload interval when using the older endpoint, which needs fresh cookies.
  // ====================================================================

  const SS = window.sessionStorage;
  const get = (k, d) => { try { return JSON.parse(SS.getItem("asw_" + k)) ?? d; } catch { return d; } };
  const set = (k, v) => { try { SS.setItem("asw_" + k, JSON.stringify(v)); } catch {} };
  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });
  const hhmm = (t) => new Date(t).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  const log = (...a) => console.log("[Apple Watcher]", now(), ...a);
  const setTitle = (s) => { try { document.title = `[${s} ${now()}] ` + document.title.replace(/^\[[^\]]*\]\s*/, ""); } catch {} };
  const PAGE_URL = location.origin + location.pathname;

  // Messages to the extension background (through bridge.js)
  const send = (data) => window.postMessage({ __asw: true, ...data }, "*");
  const notify = (title, msg, url) => send({ title, msg, url });
  let reqId = 0;
  function ask(data) {
    return new Promise((resolve) => {
      const id = "r" + ++reqId + "_" + Math.random();
      const onMsg = (e) => {
        if (e.source === window && e.data && e.data.__aswResp === id) {
          window.removeEventListener("message", onMsg);
          resolve(e.data.resp);
        }
      };
      window.addEventListener("message", onMsg);
      window.postMessage({ __asw: true, __id: id, ...data }, "*");
      setTimeout(() => { window.removeEventListener("message", onMsg); resolve(null); }, 5000);
    });
  }

  // Capture the x- headers from Apple's own pickup requests on this page (needed by the older endpoint)
  let xh = get("xh", {});
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input && input.url;
      if (url && url.includes("fulfillment-messages")) {
        const src = (init && init.headers) || (input instanceof Request ? input.headers : undefined);
        const h = new Headers(src);
        const fresh = {};
        h.forEach((v, k) => { if (k.toLowerCase().startsWith("x-")) fresh[k] = v; });
        if (Object.keys(fresh).length) { xh = fresh; set("xh", xh); }
      }
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };

  // Two Apple endpoints. "pickup" is tried first; "fulfillment" is the older one used as a fallback.
  const ENDPOINTS = {
    pickup: {
      path: "/shop/retail/pickup-message",
      params: () => ({ pl: "true", "mts.0": "regular", cppart: CPPART }),
      headers: () => ({}),
    },
    fulfillment: {
      path: "/shop/fulfillment-messages",
      params: () => ({ fae: "true", pl: "true", "mts.0": "regular", "mts.1": "compact", cppart: CPPART }),
      headers: () => xh,
    },
  };
  const lastEndpoint = () => get("lastEndpoint", "pickup");
  async function request(name, center) {
    const ep = ENDPOINTS[name];
    const p = new URLSearchParams({ ...ep.params(), ...center });
    if (center.store) p.set("searchNearby", "true");
    PARTS.forEach((part, i) => p.set(`parts.${i}`, part));
    const r = await origFetch(ep.path + "?" + p.toString(), { headers: ep.headers(), credentials: "include" });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { throw { blocked: true, status: r.status }; }
    const b = data && data.body;
    const stores = b && (b.stores || (b.content && b.content.pickupMessage && b.content.pickupMessage.stores));
    if (!Array.isArray(stores) || !stores.length) throw { blocked: true, status: r.status, reason: "no stores in response" };
    return stores;
  }

  // Always try the newer endpoint first. Use the older one only for this one check, and only when the
  // newer one fails in an unexpected way. A 541/403/429 means Apple is limiting this network, so trying
  // the other endpoint would just use up another request.
  const LIMITED = [541, 403, 429];
  async function fetchStores(center) {
    try {
      const stores = await request("pickup", center);
      set("lastEndpoint", "pickup");
      return stores;
    } catch (e) {
      log(`Endpoint pickup failed (status ${e && e.status}${e && e.reason ? ", " + e.reason : ""})`);
      if (e && LIMITED.includes(e.status)) throw e;
    }
    try {
      const stores = await request("fulfillment", center);
      set("lastEndpoint", "fulfillment");
      log("Used the older endpoint (fulfillment) for this check");
      return stores;
    } catch (e) {
      log(`Endpoint fulfillment failed (status ${e && e.status}${e && e.reason ? ", " + e.reason : ""})`);
      throw e;
    }
  }

  async function check() {
    const until = get("blockedUntil", 0);
    if (Date.now() < until) {
      log("Backing off after being blocked. Next try after", hhmm(until));
      setTitle("Waiting until " + hhmm(until));
      return;
    }

    // Only one Apple buy page tab does the checking, so opening another one to buy doesn't double the requests
    const role = await ask({ kind: "claim" });
    if (role && role.watcher === false) {
      log("Another Apple buy page tab is doing the checks. This tab will not check.");
      return;
    }

    const stores = [];
    const seen = new Set();
    try {
      for (const c of CENTERS) {
        for (const s of await fetchStores(c)) {
          if (!seen.has(s.storeName)) { seen.add(s.storeName); stores.push(s); }
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (e) {
      if (e && e.blocked) {
        const n = get("blockedCount", 0) + 1;
        set("blockedCount", n);
        // Back off: wait 5, 10, 20, then 30 minutes between retries. No requests while waiting.
        const waitMin = Math.min(5 * 2 ** (n - 1), 30);
        const blockedUntil = Date.now() + waitMin * 60 * 1000;
        set("blockedUntil", blockedUntil);
        send({ kind: "blocked", until: blockedUntil });
        log(`Blocked by Apple (status ${e.status}). Waiting ${waitMin} min before retrying.`);
        setTitle("Blocked");
        if (n === 3) notify("Apple watcher blocked", "Blocked by Apple 3 times in a row. Retrying less often. Check whether Apple is limiting you (see README FAQ).");
        setTimeout(() => location.reload(), waitMin * 60 * 1000);
        return;
      }
      log("Error", e);
      return;
    }
    set("blockedCount", 0);
    set("blockedUntil", 0);

    const hits = [];
    const available = [];
    for (const s of stores) {
      for (const [part, info] of Object.entries(s.partsAvailability || {})) {
        const st = info.pickupDisplay;
        if (st && st !== "unavailable" && st !== "ineligible") {
          hits.push(`${s.storeName}: ${part} (${st})`);
          available.push({ store: s.storeName, part });
        }
      }
    }
    if (!get("started", false)) {
      notify("Apple watcher started", `Watcher started. Checking ${stores.length} stores (endpoint: ${lastEndpoint()}).`);
      set("started", true);
      log("Stores:", stores.map((s) => s.storeName).join(", "));
    }
    send({ kind: "ok", stores: stores.length, interval: INTERVAL_MIN, url: PAGE_URL, available });
    const last = new Set(get("last", []));
    const fresh = hits.filter((h) => !last.has(h));
    if (fresh.length) notify("iPhone in stock", "In stock!\n" + fresh.join("\n"), PAGE_URL);
    set("last", hits);
    log(hits.length ? hits : "No stock");
    setTitle(hits.length ? "IN STOCK" : "No stock");
  }

  if (!PARTS.length) { log("No part numbers set. Edit PARTS in main.js."); return; }

  // Show the waiting state right away if we are still backing off from an earlier block
  if (Date.now() < get("blockedUntil", 0)) {
    setTimeout(() => setTitle("Waiting until " + hhmm(get("blockedUntil", 0))), 1000);
  }

  // Random wait around the given number of minutes (±JITTER)
  const randomWait = (min) => min * 60 * 1000 * (1 - JITTER + Math.random() * 2 * JITTER);

  // First check 20 seconds after page load, then at random intervals around INTERVAL_MIN.
  function loop() {
    check().finally(() => setTimeout(loop, randomWait(INTERVAL_MIN)));
  }
  setTimeout(loop, 20 * 1000);

  // Reload the page now and then. The older endpoint needs fresh cookies, so reload more often when using it.
  const reloadMin = lastEndpoint() === "pickup" ? RELOAD_MIN : RELOAD_MIN_FALLBACK;
  setTimeout(() => location.reload(), randomWait(reloadMin));
})();
