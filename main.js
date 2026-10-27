(() => {
  // ================== Settings (edit this part only) ==================
  // Part numbers to watch (one or more). See README, Step 2.
  const PARTS = ["MK1E4LL/A", "MK1F4LL/A"];   // Example: iPhone Duo 256GB Star White, Night Sky

  // Search centers. Apple returns the 12 nearest stores for each center; results are merged.
  // Use either { location: "ZIP code" } or { store: "store ID" }.
  const CENTERS = [{ location: "10001" }, { location: "19103" }];   // Example: New York NY, Philadelphia PA

  const CPPART = "UNLOCKED/US";  // Unlocked version. Usually leave as is.
  const INTERVAL_MIN = 5;        // Minutes between checks. Keep it at 3 or higher to avoid being blocked.
  const RELOAD_MIN = 15;         // Minutes between page reloads (lets Apple refresh its cookies).
  // ====================================================================

  const SS = window.sessionStorage;
  const get = (k, d) => { try { return JSON.parse(SS.getItem("asw_" + k)) ?? d; } catch { return d; } };
  const set = (k, v) => { try { SS.setItem("asw_" + k, JSON.stringify(v)); } catch {} };
  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });
  const log = (...a) => console.log("[Apple Watcher]", now(), ...a);
  const notify = (title, msg) => window.postMessage({ __asw: true, title, msg }, "*");
  const setTitle = (s) => { try { document.title = `[${s} ${now()}] ` + document.title.replace(/^\[[^\]]*\]\s*/, ""); } catch {} };

  // Capture the x- headers from Apple's own pickup requests on this page
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

  async function fetchStores(center) {
    const p = new URLSearchParams({
      fae: "true", pl: "true", "mts.0": "regular", "mts.1": "compact",
      cppart: CPPART, searchNearby: "true", ...center,
    });
    PARTS.forEach((part, i) => p.set(`parts.${i}`, part));
    const r = await origFetch("/shop/fulfillment-messages?" + p.toString(), { headers: xh, credentials: "include" });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { throw { blocked: true, status: r.status }; }
    return data.body.content.pickupMessage.stores;
  }

  async function check() {
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
        log("Blocked by Apple, status", e.status);
        setTitle("Blocked");
        const n = get("blockedCount", 0) + 1;
        set("blockedCount", n);
        if (n === 3) notify("Apple watcher blocked", "Blocked by Apple 3 times in a row. You may need to wait a while or reload the page.");
        setTimeout(() => location.reload(), 60 * 1000); // reload and retry in 1 minute
        return;
      }
      log("Error", e);
      return;
    }
    set("blockedCount", 0);

    const hits = [];
    for (const s of stores) {
      for (const [part, info] of Object.entries(s.partsAvailability || {})) {
        const st = info.pickupDisplay;
        if (st && st !== "unavailable" && st !== "ineligible") hits.push(`${s.storeName}: ${part} (${st})`);
      }
    }
    if (!get("started", false)) {
      notify("Apple watcher started", `Watcher started. Checking ${stores.length} stores.`);
      set("started", true);
      log("Stores:", stores.map((s) => s.storeName).join(", "));
    }
    window.postMessage({ __asw: true, kind: "ok", stores: stores.length, interval: INTERVAL_MIN }, "*");
    const last = new Set(get("last", []));
    const fresh = hits.filter((h) => !last.has(h));
    if (fresh.length) notify("iPhone in stock", "In stock!\n" + fresh.join("\n"));
    set("last", hits);
    log(hits.length ? hits : "No stock");
    setTitle(hits.length ? "IN STOCK" : "No stock");
  }

  if (!PARTS.length) { log("No part numbers set. Edit PARTS in main.js."); return; }

  // First check 20 seconds after page load, then every INTERVAL_MIN; reload the page every RELOAD_MIN
  setTimeout(() => {
    check();
    setInterval(check, INTERVAL_MIN * 60 * 1000);
  }, 20 * 1000);
  setTimeout(() => location.reload(), RELOAD_MIN * 60 * 1000);
})();
