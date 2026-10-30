const fmt = (t) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const dur = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

// Pair each "in" event with the next "out" event for the same store and part
function buildRows(history) {
  const open = new Map();
  const rows = [];
  for (const e of history) {
    const k = e.store + "|" + e.part;
    if (e.type === "in") {
      const row = { store: e.store, part: e.part, from: e.t, to: null };
      open.set(k, row);
      rows.push(row);
    } else if (open.has(k)) {
      open.get(k).to = e.t;
      open.delete(k);
    }
  }
  return rows.reverse();
}

function render(history) {
  const rows = buildRows(history);
  const stores = new Set(rows.map((r) => r.store));
  document.getElementById("summary").textContent = history.length
    ? `${rows.length} restocks at ${stores.size} stores since ${fmt(history[0].t)}.`
    : "No restocks recorded yet. Records start after the first successful check.";

  const counts = Array(24).fill(0);
  rows.forEach((r) => counts[new Date(r.from).getHours()]++);
  const max = Math.max(1, ...counts);
  document.getElementById("hours").innerHTML = counts
    .map((c, h) => `<div title="${h}:00 to ${h}:59: ${c} restocks" style="height:${(c / max) * 100}%"></div>`).join("");
  document.getElementById("hourLabels").innerHTML = counts.map((_, h) => `<span>${h % 3 === 0 ? h : ""}</span>`).join("");

  const tbody = document.getElementById("rows");
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    const cells = [r.store, r.part, fmt(r.from), r.to ? fmt(r.to) : "still in stock", r.to ? dur(r.to - r.from) : ""];
    cells.forEach((v, i) => {
      const td = document.createElement("td");
      td.textContent = v;
      if (i === 3 && !r.to) td.className = "now";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}

function toCsv(history) {
  const rows = buildRows(history).reverse();
  const iso = (t) => (t ? new Date(t).toISOString() : "");
  const lines = ["store,part,in_stock_from,sold_out_at,minutes"];
  for (const r of rows) {
    const mins = r.to ? Math.round((r.to - r.from) / 60000) : "";
    lines.push([r.store, r.part, iso(r.from), iso(r.to), mins].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}

chrome.storage.local.get(["history"], ({ history = [] }) => {
  render(history);
  document.getElementById("export").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(history)], { type: "text/csv" }));
    a.download = "apple-restock-history.csv";
    a.click();
  };
  document.getElementById("clear").onclick = () => {
    if (!window.confirm("Clear all restock history?")) return;
    chrome.storage.local.set({ history: [], avail: [] }, () => render([]));
  };
});
