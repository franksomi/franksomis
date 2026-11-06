/* Franksomi Records – quick price check in the top bar (v30). Type part of an item name or code; press / anywhere to jump to it. */
(() => {
  const hd = document.querySelector("header"); if (!hd || document.getElementById("pc")) return;
  const wrap = document.createElement("div"); wrap.id = "pcwrap"; wrap.style.cssText = "position:relative;flex:1 1 220px;max-width:340px;margin-left:auto";
  wrap.innerHTML = `<input id="pc" type="search" placeholder="Price check… (press /)" autocomplete="off" aria-label="Price check" style="width:100%"><div id="pcr" hidden style="position:absolute;left:0;right:0;top:100%;z-index:50;background:var(--card,#fff);color:var(--ink,#101828);border:1px solid var(--line,#d0d5dd);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);max-height:60vh;overflow:auto;min-width:min(340px,92vw)"></div>`;
  hd.insertBefore(wrap, hd.querySelector("#who") ? hd.querySelector("#who").nextSibling : null);
  const inp = wrap.querySelector("#pc"), box = wrap.querySelector("#pcr"); let data = null, at = 0, busy = false;
  const E = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const K = v => Number(v).toLocaleString("en-KE", { maximumFractionDigits: 2 });
  async function load() {
    if (busy || (data && Date.now() - at < 60000)) return; busy = true;
    try { const items = [];
      if (can("inventory.view")) { const r = await db.from("v_stock").select("id,code,description,on_hand,selling_price,stock_type").order("description"); (r.data || []).forEach(i => items.push({ kind: "stock", name: i.description, code: i.code, type: i.stock_type, price: i.selling_price, left: i.on_hand })); }
      const c = await db.from("service_catalog").select("name,unit,default_price,active"); (c.data || []).filter(x => x.active !== false).forEach(x => items.push({ kind: "service", name: x.name, code: "", type: "Service", price: x.default_price, unit: x.unit }));
      data = items; at = Date.now(); } catch (e) { data = data || []; } busy = false; draw();
  }
  function draw() {
    const q = inp.value.trim().toLowerCase(); if (!q) { box.hidden = true; return; }
    if (!data) { box.hidden = false; box.innerHTML = `<p style="margin:10px 12px">Loading…</p>`; return; }
    const w = q.split(/\s+/), hit = data.filter(i => { const t = [i.name, i.code, i.type].join(" ").toLowerCase(); return w.every(x => t.includes(x)); })
      .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name)).slice(0, 12);
    box.hidden = false;
    box.innerHTML = hit.map(i => `<div class="pcrow" style="display:flex;justify-content:space-between;gap:12px;padding:9px 12px;border-bottom:1px solid var(--line,#eee)"><div><b>${E(i.name)}</b><br><small style="color:var(--mut,#667085)">${E([i.code, i.type].filter(Boolean).join(" · "))}${i.kind === "service" && i.unit ? " · per " + E(i.unit) : ""}</small></div>
      <div style="text-align:right;white-space:nowrap"><b style="font-size:1.1rem">${i.price == null || i.price === "" ? "No price" : "KES " + K(i.price)}</b>${i.kind === "stock" ? `<br><small style="color:${Number(i.left) <= 0 ? "#b42318" : "var(--mut,#667085)"}">${Number(i.left) <= 0 ? "Out of stock" : K(i.left) + " in stock"}</small>` : ""}</div></div>`).join("") || `<p style="margin:10px 12px">Nothing found for “${E(inp.value.trim())}”.</p>`;
  }
  inp.addEventListener("focus", () => { load(); draw(); });
  inp.addEventListener("input", () => { if (!data || Date.now() - at > 60000) load(); draw(); });
  inp.addEventListener("keydown", e => { if (e.key === "Escape") { inp.value = ""; box.hidden = true; inp.blur(); } });
  document.addEventListener("click", e => { if (!wrap.contains(e.target)) box.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "/" && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "") && !(document.activeElement || {}).isContentEditable) { e.preventDefault(); inp.focus(); inp.select(); } });
})();
