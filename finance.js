/* Franksomi Records v26 — business health, assets, money & loans, report charts.
   Loaded before app.js; every function only touches app.js globals (db, can, kes, tbl, esc, $, toast, must ...) when it is called. */

// ---- small SVG chart helpers (colours come from CSS variables so they follow the theme) --------------------------
const FC = { good: "#12b76a", bad: "#e5484d", blue: "#0d6eae", orange: "#ff914d", violet: "#7a5af8" };
const fShort = v => { v = Number(v) || 0; const a = Math.abs(v), s = v < 0 ? "-" : ""; return a >= 1e6 ? s + (a / 1e6).toFixed(a % 1e6 ? 1 : 0) + "M" : a >= 1e3 ? s + (a / 1e3).toFixed(a % 1e3 ? 1 : 0) + "k" : s + Math.round(a); };
const fNice = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
// line chart: labels = x labels, series = [{ n, c, v: [numbers] }]. Handles negatives.
function fLine(labels, series, aria) {
  const W = 640, H = 220, L = 46, R = 8, T = 12, B = 190, all = series.flatMap(s => s.v.map(Number));
  if (!labels.length || !all.some(v => v)) return `<p style="color:var(--mut);margin:6px 0">Nothing to show yet.</p>`;
  const hi = Math.max(0, ...all), lo = Math.min(0, ...all), top = fNice(hi || 1), bot = lo < 0 ? -fNice(-lo) : 0;
  const y = v => B - (v - bot) / (top - bot) * (B - T), x = i => labels.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (labels.length - 1);
  const grid = [0, 1, 2, 3, 4].map(i => { const v = bot + (top - bot) * i / 4; return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--mut)">${fShort(v)}</text>`; }).join("");
  const every = Math.ceil(labels.length / 12), xs = labels.map((l, i) => i % every === 0 || i === labels.length - 1 ? `<text x="${x(i)}" y="${B + 16}" text-anchor="middle" font-size="11" fill="var(--mut)">${esc(l)}</text>` : "").join("");
  const lines = series.map(s => `<polyline fill="none" stroke="${s.c}" stroke-width="2.5" stroke-linejoin="round" points="${s.v.map((v, i) => `${x(i).toFixed(1)},${y(Number(v)).toFixed(1)}`).join(" ")}"/>${s.v.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(Number(v)).toFixed(1)}" r="3" fill="${s.c}"><title>${esc(labels[i])} · ${esc(s.n)}: KES ${Math.round(Number(v)).toLocaleString("en-KE")}</title></circle>`).join("")}`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(aria)}">${grid}${lines}${xs}</svg><div class="legend">${series.map(s => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join("")}</div>`;
}
// grouped bars (can be negative): labels, series = [{ n, c, v }]
function fBars(labels, series, aria) {
  const W = 640, H = 220, L = 46, R = 8, T = 12, B = 190, all = series.flatMap(s => s.v.map(Number));
  if (!labels.length || !all.some(v => v)) return `<p style="color:var(--mut);margin:6px 0">Nothing to show yet.</p>`;
  const hi = Math.max(0, ...all), lo = Math.min(0, ...all), top = fNice(hi || 1), bot = lo < 0 ? -fNice(-lo) : 0, y = v => B - (v - bot) / (top - bot) * (B - T);
  const step = (W - L - R) / labels.length, bw = Math.max(3, Math.min(16, step / (series.length + 1)));
  const grid = [0, 1, 2, 3, 4].map(i => { const v = bot + (top - bot) * i / 4; return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--mut)">${fShort(v)}</text>`; }).join("");
  const cols = labels.map((l, i) => { const cx = L + step * i + step / 2, x0 = cx - bw * series.length / 2;
    return `<g>${series.map((s, k) => { const v = Number(s.v[i]) || 0, y0 = y(0), yy = y(v); return `<rect x="${(x0 + k * bw).toFixed(1)}" y="${Math.min(y0, yy).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${Math.abs(y0 - yy).toFixed(1)}" rx="2" fill="${v < 0 && series.length === 1 ? FC.bad : s.c}"><title>${esc(l)} · ${esc(s.n)}: KES ${Math.round(v).toLocaleString("en-KE")}</title></rect>`; }).join("")}<text x="${cx.toFixed(1)}" y="${B + 16}" text-anchor="middle" font-size="11" fill="var(--mut)">${esc(l)}</text></g>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(aria)}">${grid}${cols}</svg>${series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join("")}</div>` : ""}`;
}
// tiny trend line for a card
function fSpark(vals, c = FC.blue) {
  vals = vals.map(Number); if (vals.length < 2) return "";
  const mx = Math.max(...vals), mn = Math.min(...vals), W = 120, H = 28, y = v => mx === mn ? H / 2 : H - 3 - (v - mn) / (mx - mn) * (H - 6);
  return `<svg viewBox="0 0 ${W} ${H}" width="120" height="28" role="img" aria-label="trend"><polyline fill="none" stroke="${c}" stroke-width="2" points="${vals.map((v, i) => `${(i * W / (vals.length - 1)).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/></svg>`;
}
// stacked bar of owns vs owes
const fOwn = (own, owe) => { const t = own + owe || 1; return `<div style="display:flex;height:18px;border-radius:9px;overflow:hidden;background:var(--line)" role="img" aria-label="Owns KES ${Math.round(own)}, owes KES ${Math.round(owe)}"><i style="width:${own / t * 100}%;background:${FC.good}"></i><i style="width:${owe / t * 100}%;background:${FC.bad}"></i></div><div class="legend"><span><i style="background:${FC.good}"></i>Owns</span><span><i style="background:${FC.bad}"></i>Owes</span></div>`; };
const fMonth = s => { const [y, m] = String(s).split("-"); return MONTHS[Number(m) - 1] + " " + String(y).slice(2); };
const fPct = (a, b) => b > 0 ? Math.round(a / b * 1000) / 10 + "%" : "–";
const fSign = v => (Number(v) >= 0 ? "" : "−") + kes(Math.abs(Number(v)));
const fTone = v => Number(v) >= 0 ? "color:#067647" : "color:#b42318";
const ALERT_TAG = { bad: "bad", warn: "warn", info: "" };
const alertList = (al, nav = true) => al.length ? `<div class="attrow">${al.map(a => `<${nav && a.page ? `a href="#${esc(a.page)}"` : "div"} class="att" style="display:block;text-decoration:none;color:inherit;${a.level === "bad" ? "background:#fecdca;" : a.level === "info" ? "background:var(--line);" : ""}"><b>${esc(a.title)}</b><br><small>${esc(a.detail || "")}</small></${nav && a.page ? "a" : "div"}>`).join("")}</div>` : `<p style="margin:0;color:#067647">All clear. Nothing needs attention right now.</p>`;
const insightList = ins => ins.length ? `<ul class="ins">${ins.map(i => `<li class="${esc(i.kind || "info")}"><b>${esc(i.title)}</b><br><small>${esc(i.detail || "")}</small></li>`).join("")}</ul>` : `<p style="color:var(--mut)">Not enough history yet for insights.</p>`;

// ---- statements as HTML (used on screen and in print) -----------------------------------------------------------
function incomeStatementHtml(s) {
  const rl = s.revenue_lines || [], el = s.expense_lines || [];
  const rows = [["Revenue", ""], ...rl.map(x => ["  " + x.line, x.amount]), ["Total revenue", s.revenue], ["Cost of stock sold (retail)", -s.cogs_retail], ["Cost of parts used (repairs)", -s.cogs_repairs], ["Gross profit", s.gross_profit], ["Operating expenses", ""], ...el.map(x => ["  " + x.category, -x.amount]), ["Total operating expenses", -s.expenses], ["Operating profit", s.operating_profit], ["Depreciation of assets", -s.depreciation]];
  if (Number(s.disposal_gain)) rows.push([Number(s.disposal_gain) >= 0 ? "Gain on assets sold" : "Loss on assets sold", s.disposal_gain]);
  rows.push(["Net profit", s.net_profit]);
  const bold = new Set(["Total revenue", "Gross profit", "Total operating expenses", "Operating profit", "Net profit", "Revenue", "Operating expenses"]);
  return `<table><tbody>${rows.map(r => `<tr${bold.has(r[0]) ? ' style="font-weight:700"' : ""}><td style="white-space:pre">${esc(r[0])}</td><td class="n">${r[1] === "" ? "" : fSign(r[1])}</td></tr>`).join("")}</tbody></table>
    <p style="color:var(--mut);font-size:13px">Stock bought in the period: KES ${kes(s.stock_bought)} (not an expense — only the cost of stock actually sold is). ${Number(s.owner_drawings) ? `Owner drawings (not an expense): KES ${kes(s.owner_drawings)}.` : ""}</p>`;
}
function balanceSheetHtml(b) {
  const A = b.assets || {}, Lb = b.liabilities || {};
  const c = (b.cash && b.cash.accounts) || [];
  return `<table><tbody><tr style="font-weight:700"><td>What the business owns</td><td class="n"></td></tr>
    ${c.map(a => `<tr><td>&nbsp;&nbsp;${esc(a.method)}</td><td class="n">${kes(a.balance)}</td></tr>`).join("")}
    <tr><td>&nbsp;&nbsp;Owed to us by credit customers</td><td class="n">${kes(A.receivables)}</td></tr><tr><td>&nbsp;&nbsp;Stock in the shop (at cost)</td><td class="n">${kes(A.stock)}</td></tr>
    <tr><td>&nbsp;&nbsp;Equipment & assets (after depreciation)</td><td class="n">${kes(A.fixed)}</td></tr><tr><td>&nbsp;&nbsp;Staff advances to recover</td><td class="n">${kes(A.staff_advances)}</td></tr>
    <tr style="font-weight:700"><td>Total owned</td><td class="n">${kes(A.total)}</td></tr>
    <tr style="font-weight:700"><td>What the business owes</td><td class="n"></td></tr>
    <tr><td>&nbsp;&nbsp;Suppliers</td><td class="n">${kes(Lb.suppliers)}</td></tr><tr><td>&nbsp;&nbsp;Loans</td><td class="n">${kes(Lb.loans)}</td></tr>
    <tr><td>&nbsp;&nbsp;Customer repair deposits held</td><td class="n">${kes(Lb.customer_deposits)}</td></tr><tr><td>&nbsp;&nbsp;Customer credit balances</td><td class="n">${kes(Lb.customer_credit)}</td></tr>
    <tr style="font-weight:700"><td>Total owed</td><td class="n">${kes(Lb.total)}</td></tr>
    <tr style="font-weight:700"><td>Net worth (owns − owes)</td><td class="n" style="${fTone(b.net_worth)}">${fSign(b.net_worth)}</td></tr></tbody></table>`;
}
function cashFlowHtml(c) {
  const ls = c.lines || [], tin = sumBy(ls, x => x.money_in), tout = sumBy(ls, x => x.money_out);
  return `<table><thead><tr><th>Source</th><th>Money in</th><th>Money out</th></tr></thead><tbody><tr><td>Money at the start (${esc(c.from)})</td><td class="n">${kes(c.opening)}</td><td></td></tr>
    ${ls.map(x => `<tr><td>${esc(x.source)}</td><td class="n">${Number(x.money_in) ? kes(x.money_in) : ""}</td><td class="n">${Number(x.money_out) ? kes(x.money_out) : ""}</td></tr>`).join("")}
    <tr style="font-weight:700"><td>Totals</td><td class="n">${kes(tin)}</td><td class="n">${kes(tout)}</td></tr><tr style="font-weight:700"><td>Money at the end (${esc(c.to)})</td><td class="n">${kes(c.closing)}</td><td></td></tr></tbody></table>`;
}
const moneyCards = pos => `<div class="cards">${(pos.accounts || []).map(a => {
  const ck = a.check, st = !ck ? `<span class="tag warn">not checked yet</span>` : Math.abs(Number(ck.difference)) < 1 ? `<span class="tag ok">matches your count (${esc(ck.on)})</span>` : `<span class="tag bad">${Number(ck.difference) > 0 ? "records are KES " + kes(ck.difference) + " too high" : "records are KES " + kes(-ck.difference) + " too low"} (${esc(ck.on)})</span>`;
  return `<div class="card"><small>${esc(a.method)}</small><b style="${fTone(a.balance)}">KES ${fSign(a.balance)}</b><br>${st}</div>`; }).join("")}<div class="card"><small>All money together</small><b style="${fTone(pos.total)}">KES ${fSign(pos.total)}</b></div></div>`;

// ---- Business health ------------------------------------------------------------------------------------------------
async function healthPage() {
  const h = must(await db.rpc("business_health")), bs = h.balance_sheet, A = bs.assets, Lb = bs.liabilities, mo = h.month, yr = h.year, lm = h.last_month, S = h.series || [];
  const ins = can("reports.view+costs.view") ? ((await db.rpc("management_insights")).data || []) : [];
  const margin = fPct(mo.net_profit, mo.revenue), ok = Number(mo.net_profit) >= 0;
  const snaps = h.snapshots || [];
  const f0 = sessionStorage.getItem("hFrom") || h.today.slice(0, 8) + "01", t0 = sessionStorage.getItem("hTo") || h.today;
  $("#view").innerHTML = `<h2>Business health</h2>
    <p style="color:var(--mut);margin-top:0">The three questions, answered from your records as of today (${esc(h.today)}).</p>
    <div class="panel" id="hq1"><h3>1 · Are we making money?</h3>
      <div class="cards"><div class="card"><small>This month so far</small><b style="${fTone(mo.net_profit)}">KES ${fSign(mo.net_profit)}</b><br><small>${ok ? "Profit" : "Loss"} · margin ${margin}</small></div>
      <div class="card"><small>Last month</small><b style="${fTone(lm.net_profit)}">KES ${fSign(lm.net_profit)}</b><br><small>Revenue KES ${kes(lm.revenue)}</small></div>
      <div class="card"><small>This year so far</small><b style="${fTone(yr.net_profit)}">KES ${fSign(yr.net_profit)}</b><br><small>Revenue KES ${kes(yr.revenue)} · margin ${fPct(yr.net_profit, yr.revenue)}</small></div>
      <div class="card"><small>Revenue this month</small><b>KES ${kes(mo.revenue)}</b><br><small>Costs KES ${kes(Number(mo.revenue) - Number(mo.net_profit))}</small></div></div>
      <p style="margin:6px 0"><b>${ok ? "Yes — the business is profitable this month." : "Not this month — costs are higher than revenue so far."}</b> Profit here means revenue, less the cost of stock sold, running costs and depreciation.</p>
      ${fBars(S.map(m => fMonth(m.month)), [{ n: "Revenue", c: FC.blue, v: S.map(m => m.revenue) }, { n: "Costs", c: FC.orange, v: S.map(m => m.costs) }], "Revenue and costs for each of the last 12 months")}
      ${fBars(S.map(m => fMonth(m.month)), [{ n: "Net profit", c: FC.good, v: S.map(m => m.net) }], "Net profit for each of the last 12 months")}</div>
    <div class="panel" id="hq2"><h3>2 · How much money do we actually have?</h3>${moneyCards(bs.cash)}
      <p style="margin:6px 0">Bills to pay in the next 30 days: <b>KES ${kes(h.bills_30)}</b> to suppliers${Number(h.loans_30) ? ` + <b>KES ${kes(h.loans_30)}</b> loans` : ""}. After those, money left: <b style="${fTone(Number(bs.cash.total) - Number(h.bills_30) - Number(h.loans_30))}">KES ${fSign(Number(bs.cash.total) - Number(h.bills_30) - Number(h.loans_30))}</b>.</p>
      <p style="color:var(--mut);font-size:13px;margin:4px 0">This is what your records say. Count the till, check M-Pesa and the bank, then record it under <a href="#money">Money &amp; loans</a> — the difference shows what is missing from the records.</p></div>
    <div class="panel" id="hq3"><h3>3 · What does the business own and owe?</h3>
      <div class="cards"><div class="card"><small>Owns</small><b>KES ${kes(A.total)}</b></div><div class="card"><small>Owes</small><b>KES ${kes(Lb.total)}</b></div><div class="card"><small>Net worth</small><b style="${fTone(bs.net_worth)}">KES ${fSign(bs.net_worth)}</b></div></div>
      ${fOwn(Number(A.total), Number(Lb.total))}
      <div class="wrap" style="margin-top:8px">${balanceSheetHtml(bs)}</div>
      ${snaps.length > 1 ? `<h4>Net worth over time <small style="color:var(--mut)">(one point each time a day is closed)</small></h4>${fLine(snaps.map(s => String(s.day).slice(5)), [{ n: "Net worth", c: FC.blue, v: snaps.map(s => s.net_worth) }, { n: "Money held", c: FC.good, v: snaps.map(s => s.cash) }], "Net worth and money held over time")}` : `<p style="color:var(--mut);font-size:13px">The history of net worth builds up each time you close a day (End of day). <button class="btn sm ghost" id="snap">Save a snapshot now</button></p>`}</div>
    <div class="panel" id="hal"><h3>Needs attention <span class="tag">${(h.alerts || []).length}</span></h3>${alertList(h.alerts || [])}</div>
    ${can("reports.view+costs.view") ? `<div class="panel" id="hin"><h3>Management insights</h3>${insightList(ins)}</div>` : ""}
    <div class="panel" id="hst"><h3>Financial statements</h3><div class="bar"><label>From <input type="date" id="hf" value="${f0}"></label><label>To <input type="date" id="ht" value="${t0}"></label><button class="btn" id="hgo">Show</button><button class="btn pbtn" id="hpr">Print statements</button></div><div id="hout"><p style="color:var(--mut)">Loading…</p></div></div>`;
  const sn = $("#snap"); if (sn) sn.onclick = async () => { const x = await db.rpc("take_snapshot"); if (x.error) return toast(x.error.message); toast("Snapshot saved"); route(); };
  let printable = "";
  const load = async () => {
    const f = $("#hf").value, t = $("#ht").value; sessionStorage.setItem("hFrom", f); sessionStorage.setItem("hTo", t);
    const [i, c] = await Promise.all([db.rpc("income_statement", { p_from: f, p_to: t }), db.rpc("cash_flow_statement", { p_from: f, p_to: t })]);
    if (i.error || c.error) { $("#hout").innerHTML = `<p class="tag bad">${esc((i.error || c.error).message)}</p>`; return; }
    printable = `<h3>Income statement (profit &amp; loss) — ${esc(f)} to ${esc(t)}</h3>${incomeStatementHtml(i.data)}<h3>Cash flow — ${esc(f)} to ${esc(t)}</h3>${cashFlowHtml(c.data)}<h3>Balance sheet — ${esc(h.today)}</h3>${balanceSheetHtml(bs)}`;
    $("#hout").innerHTML = `<div class="wrap"><h4>Income statement</h4>${incomeStatementHtml(i.data)}</div><div class="wrap"><h4>Cash flow</h4>${cashFlowHtml(c.data)}</div><p style="color:var(--mut);font-size:13px">The balance sheet is shown above (Question 3).</p>`;
  };
  $("#hgo").onclick = load; $("#hpr").onclick = async () => { if (!printable) await load(); printHtml(head("MANAGEMENT ACCOUNTS", h.today) + printable + `<p style="font-size:12px">Management accounts prepared from the business records. Not audited.</p>`, "Management accounts " + h.today + ".pdf"); };
  load();
}

// ---- Assets ----------------------------------------------------------------------------------------------------------------
const ASSET_CATS = ["Equipment", "Computers & phones", "Tools", "Furniture & fittings", "Network equipment", "Vehicle", "Software", "Other"];
async function assetsPage() {
  const r = must(await db.rpc("assets_report")), rows = r.assets || [], live = rows.filter(a => !["Disposed", "Lost"].includes(a.status)), edit = can("finance.edit");
  const cost = sumBy(live, a => a.cost), book = sumBy(live, a => a.book_value), dep = sumBy(live, a => a.accumulated);
  const cats = {}; live.forEach(a => cats[a.category] = (cats[a.category] || 0) + Number(a.book_value));
  const soon = (d, n = 30) => d && d <= iso(new Date(Date.now() + n * 864e5));
  const q = new Date().toISOString().slice(0, 10);
  $("#view").innerHTML = `<h2>Assets</h2><p style="color:var(--mut);margin-top:0">Things the business owns that last more than a year: equipment, computers, tools, vehicles. Each loses value (depreciation) a little each day, and what is left counts in what the business owns.</p>
    <div class="cards"><div class="card"><small>Assets in use</small><b>${live.length}</b></div><div class="card"><small>Bought for</small><b>KES ${kes(cost)}</b></div><div class="card"><small>Worth now (after depreciation)</small><b>KES ${kes(book)}</b></div><div class="card"><small>Depreciated so far</small><b>KES ${kes(dep)}</b></div></div>
    <div class="panel"><h3>Worth by category</h3>${hbars(Object.entries(cats).map(([l, v], i) => ({ l, v, c: PALETTE[i % PALETTE.length] })).sort((a, b) => b.v - a.v))}</div>
    <div class="bar"><input id="q" placeholder="Search assets…">${edit ? `<button class="btn" id="a_new">+ Add an asset</button><button class="btn ghost" id="a_exp">Move an expense into assets</button>` : ""}</div>
    <div class="wrap"><table><thead><tr><th>No.</th><th>Asset</th><th>Category</th><th>Bought</th><th>Cost</th><th>Worth now</th><th>Status</th><th>Where / who</th><th>Dates</th><th></th></tr></thead><tbody id="tb">${rows.map((a, i) => `<tr><td>${esc(a.asset_no)}</td><td><b>${esc(a.name)}</b>${a.serial_no ? `<br><small>S/N ${esc(a.serial_no)}</small>` : ""}</td><td>${esc(a.category)}</td><td>${esc(a.acquired_on)}</td><td class="n">${kes(a.cost)}</td><td class="n">${kes(a.book_value)}</td>
      <td><span class="tag ${a.status === "Under repair" ? "warn" : ["Disposed", "Lost"].includes(a.status) ? "bad" : ""}">${esc(a.status)}</span></td><td>${esc([a.location, a.assigned_to].filter(Boolean).join(" · "))}</td>
      <td><small>${a.warranty_until ? `Warranty ${esc(a.warranty_until)}${a.warranty_until < q ? " (ended)" : soon(a.warranty_until) ? " ⚠" : ""}<br>` : ""}${a.insured_until ? `Insured to ${esc(a.insured_until)}${a.insured_until < q ? " (expired)" : soon(a.insured_until) ? " ⚠" : ""}<br>` : ""}${a.next_service_on ? `Service ${esc(a.next_service_on)}${a.next_service_on < q ? " (overdue)" : soon(a.next_service_on) ? " ⚠" : ""}` : ""}</small></td>
      <td>${edit ? `<button class="btn sm ghost" data-e="${i}">Edit</button> ${!["Disposed", "Lost"].includes(a.status) ? `<button class="btn sm ghost" data-s="${i}">Sold / lost</button> ` : ""}<button class="btn sm ghost" data-d="${i}">Delete</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="10" style="color:var(--mut)">No assets recorded yet.</td></tr>`}</tbody></table></div>
    ${rows.some(a => a.status === "Disposed") ? `<p style="color:var(--mut);font-size:13px">Sold assets: ${rows.filter(a => a.status === "Disposed").map(a => `${esc(a.name)} for KES ${kes(a.disposal_proceeds)} (${Number(a.gain) >= 0 ? "gain" : "loss"} KES ${kes(Math.abs(a.gain))})`).join("; ")}.</p>` : ""}`;
  $("#q").oninput = e => { const t = e.target.value.toLowerCase(); document.querySelectorAll("#tb tr").forEach(tr => tr.hidden = !tr.textContent.toLowerCase().includes(t)); };
  if (!edit) return;
  $("#a_new").onclick = () => assetDialog(null); $("#a_exp").onclick = () => assetFromExpenseDialog();
  $("#tb").onclick = async e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.e !== undefined) assetDialog(rows[b.dataset.e]);
    else if (b.dataset.s !== undefined) assetDisposeDialog(rows[b.dataset.s]);
    else if (b.dataset.d !== undefined) { const a = rows[b.dataset.d]; if (!confirm(`Delete ${a.name} from the register? This also removes the payment recorded for it.`)) return; const x = await db.rpc("asset_delete", { p_id: a.id }); if (x.error) return toast(x.error.message); toast("Deleted"); assetsPage(); } };
}
const assetFields = a => `<label class="full">What is it<input name="name" required value="${esc(a?.name || "")}" placeholder="e.g. Laptop HP 15, Mikrotik router"></label>
  <label>Category<select name="category">${ASSET_CATS.map(c => `<option ${a?.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
  <label>Date bought<input name="acquired_on" type="date" required value="${esc(a?.acquired_on || iso(new Date()))}"></label>
  <label>Cost (KES)<input name="cost" type="number" min="0.01" step="0.01" required inputmode="decimal" value="${esc(a?.cost ?? "")}"></label>
  <label>Resale value at the end of its life (KES)<input name="salvage_value" type="number" min="0" step="0.01" value="${esc(a?.salvage_value ?? 0)}"></label>
  <label>Depreciation<select name="method"><option value="Straight line" ${a?.method !== "None" ? "selected" : ""}>Spread evenly over its life</option><option value="None" ${a?.method === "None" ? "selected" : ""}>Not depreciated (keeps its cost)</option></select></label>
  <label>Useful life (months)<input name="life_months" type="number" min="1" step="1" value="${esc(a?.life_months ?? 36)}"></label>
  <label>Serial number<input name="serial_no" value="${esc(a?.serial_no || "")}"></label><label>Where it is<input name="location" value="${esc(a?.location || "")}"></label>
  <label>Who uses it<input name="assigned_to" value="${esc(a?.assigned_to || "")}"></label><label>Bought from<input name="supplier" value="${esc(a?.supplier || "")}"></label>
  <label>Warranty until<input name="warranty_until" type="date" value="${esc(a?.warranty_until || "")}"></label><label>Insured until<input name="insured_until" type="date" value="${esc(a?.insured_until || "")}"></label>
  <label>Next service due<input name="next_service_on" type="date" value="${esc(a?.next_service_on || "")}"></label>
  <label>Status<select name="status">${["In use", "Under repair", "Idle"].map(s => `<option ${a?.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
  <label class="full">Notes<input name="notes" value="${esc(a?.notes || "")}"></label>`;
const assetPayload = el => { const o = {}; ["name", "category", "acquired_on", "cost", "salvage_value", "method", "life_months", "serial_no", "location", "assigned_to", "supplier", "warranty_until", "insured_until", "next_service_on", "status", "notes", "paid_from"].forEach(k => { if (el[k] && el[k].value !== "") o[k] = el[k].value; }); if (o.method === "None") delete o.life_months; return o; };
function assetDialog(a) {
  const f = $("#dlgForm"); f.oninput = f.onchange = f.onclick = null;
  f.innerHTML = `<h2>${a ? "Edit asset " + esc(a.asset_no) : "Add an asset"}</h2><div class="grid">${assetFields(a)}
    ${a ? "" : `<label class="full">Paid from<select name="paid_from"><option value="">Already recorded elsewhere / not paid from the till</option><option>Cash</option><option>M-Pesa</option><option>Bank</option></select></label><p class="full" style="color:var(--mut);font-size:13px;margin:0">Choose where the money came from so your cash balance drops by the cost. If you already entered this purchase as an expense, use “Move an expense into assets” instead so it is not counted twice.</p>`}</div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const x = await db.rpc("asset_save", { p_id: a ? a.id : null, p: assetPayload(f.elements) }); if (x.error) return toast(x.error.message); $("#dlg").close(); toast("Saved"); assetsPage(); };
  $("#dlg").showModal();
}
async function assetFromExpenseDialog() {
  const ex = (must(await db.from("expenses").select("id,spent_on,description,category,amount,payment").order("spent_on", { ascending: false }).limit(300)) || []).filter(x => !Object.values(PAYKINDS).includes(x.category) && x.category !== "Stock purchase");
  const f = $("#dlgForm"); f.oninput = f.onchange = f.onclick = null;
  f.innerHTML = `<h2>Move an expense into assets</h2><p style="color:var(--mut);margin-top:0">For a purchase that was entered as an expense but is really equipment you keep (a router, a laptop). The expense is removed and the asset is added, with the same money taken from the same place, so your cash stays right and profit is no longer reduced by the full price.</p>
    <div class="grid"><label class="full">Expense<select name="exp" required><option value="">Choose…</option>${ex.map(x => `<option value="${x.id}">${esc(x.spent_on)} · ${esc(x.description || x.category || "")} · KES ${kes(x.amount)} · ${esc(x.payment || "")}</option>`).join("")}</select></label>${assetFields(null)}</div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Move into assets</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  const el = f.elements; el.exp.onchange = () => { const x = ex.find(v => String(v.id) === el.exp.value); if (!x) return; el.cost.value = x.amount; el.acquired_on.value = x.spent_on; if (!el.name.value) el.name.value = x.description || ""; };
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); if (!el.exp.value) return toast("Choose the expense.");
    const x = await db.rpc("asset_from_expense", { p_expense_id: Number(el.exp.value), p: assetPayload(el) }); if (x.error) return toast(x.error.message); $("#dlg").close(); toast("Moved into assets"); assetsPage(); };
  $("#dlg").showModal();
}
function assetDisposeDialog(a) {
  const f = $("#dlgForm"); f.oninput = f.onchange = f.onclick = null;
  f.innerHTML = `<h2>${esc(a.name)} — sold, scrapped or lost</h2><div class="grid"><label>What happened<select name="st"><option value="Disposed">Sold / scrapped</option><option value="Lost">Lost or stolen</option></select></label>
    <label>Date<input name="on" type="date" value="${iso(new Date())}" required></label><label>Money received (KES, 0 if none)<input name="pr" type="number" min="0" step="0.01" value="0"></label>
    <label>Received into<select name="to"><option>Cash</option><option>M-Pesa</option><option>Bank</option></select></label><label class="full">Note<input name="note"></label></div>
    <p style="color:var(--mut);font-size:13px">It stops depreciating, leaves what you own, and any difference between what it was worth and what you got shows as a gain or loss.</p>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  const el = f.elements;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const pr = Number(el.pr.value) || 0;
    const x = await db.rpc("asset_dispose", { p_id: a.id, p_date: el.on.value, p_proceeds: pr, p_to: pr > 0 ? el.to.value : null, p_status: el.st.value, p_note: el.note.value.trim() || null }); if (x.error) return toast(x.error.message); $("#dlg").close(); toast("Saved"); assetsPage(); };
  $("#dlg").showModal();
}

// ---- Money & loans ------------------------------------------------------------------------------------------------------------
async function moneyPage() {
  const pos = must(await db.rpc("money_position")), edit = can("finance.edit");
  const moves = must(await db.from("fund_moves").select("*").order("moved_on", { ascending: false }).order("id", { ascending: false }).limit(200)) || [];
  const loans = must(await db.from("loans").select("*").order("borrowed_on", { ascending: false }).limit(100)) || [];
  const checks = must(await db.from("balance_checks").select("*").order("checked_on", { ascending: false }).order("id", { ascending: false }).limit(30)) || [];
  const owed = l => Number(l.principal) - sumBy(moves.filter(m => m.loan_id === l.id && m.kind === "Loan repayment"), m => m.amount);
  const acc = pos.accounts || [];
  $("#view").innerHTML = `<h2>Money &amp; loans</h2><p style="color:var(--mut);margin-top:0">Where the money is: cash in the drawer, M-Pesa and the bank. Set the starting balance once, then every sale, payment and expense moves it. Count the real money now and then to catch anything missing from the records.</p>
    ${moneyCards(pos)}
    <div class="panel"><h3>Starting balances &amp; checks</h3><div class="wrap"><table><thead><tr><th>Account</th><th>Started with</th><th>On</th><th>Money in</th><th>Money out</th><th>Records say now</th><th>Last real count</th><th></th></tr></thead><tbody>${acc.map(a => `<tr><td><b>${esc(a.method)}</b></td><td class="n">${kes(a.opening)}</td><td>${esc(a.opening_date)}</td><td class="n">${kes(a.money_in)}</td><td class="n">${kes(a.money_out)}</td><td class="n"><b>${fSign(a.balance)}</b></td>
      <td>${a.check ? `${kes(a.check.actual)} on ${esc(a.check.on)} <span class="tag ${Math.abs(Number(a.check.difference)) < 1 ? "ok" : "bad"}">${Math.abs(Number(a.check.difference)) < 1 ? "matches" : "off by " + fSign(a.check.difference)}</span>` : `<span class="tag warn">never counted</span>`}</td>
      <td>${edit ? `<button class="btn sm ghost" data-o="${esc(a.method)}">Set start</button> <button class="btn sm" data-c="${esc(a.method)}">Record real count</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
      <p style="color:var(--mut);font-size:13px;margin:6px 0 0">“Off by” compares what the records said on the day of your count with what you actually counted. A positive number means the records were too high — some money went out (or was never recorded as income) without being written down.</p></div>
    ${edit ? `<div class="panel"><h3>Move or add money</h3><div class="bar"><button class="btn" data-m="Transfer">Move between accounts</button><button class="btn ghost" data-m="Owner capital">Owner puts money in</button><button class="btn ghost" data-m="Owner drawings">Owner takes money out</button></div>
      <p style="color:var(--mut);font-size:13px;margin:6px 0 0">Banking cash, withdrawing from the bank, or sending M-Pesa to the bank is a <b>move</b> — it is not income or an expense. Money the owner takes for personal use is <b>drawings</b>, not an expense.</p></div>` : ""}
    <div class="panel"><h3>Loans</h3>${edit ? `<div class="bar"><button class="btn" id="l_new">+ Record a loan received</button></div>` : ""}<div class="wrap"><table><thead><tr><th>Lender</th><th>Borrowed on</th><th>Amount</th><th>Repaid</th><th>Still owed</th><th>Due</th><th></th></tr></thead><tbody>${loans.map(l => `<tr><td>${esc(l.lender)}${l.notes ? `<br><small>${esc(l.notes)}</small>` : ""}</td><td>${esc(l.borrowed_on)}</td><td class="n">${kes(l.principal)}</td><td class="n">${kes(Number(l.principal) - owed(l))}</td><td class="n"><b>${kes(owed(l))}</b></td><td>${esc(l.due_on || "")}${l.due_on && owed(l) > 0 && l.due_on < iso(new Date()) ? ` <span class="tag bad">overdue</span>` : ""}</td>
      <td>${edit ? `${owed(l) > 0 ? `<button class="btn sm" data-r="${l.id}">Repay</button> ` : ""}<button class="btn sm ghost" data-ld="${l.id}">Delete</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7" style="color:var(--mut)">No loans recorded.</td></tr>`}</tbody></table></div></div>
    <div class="panel"><h3>Money movements</h3><div class="wrap"><table><thead><tr><th>Date</th><th>What</th><th>From</th><th>To</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>${moves.map(m => `<tr><td>${esc(m.moved_on)}</td><td>${esc(m.kind)}</td><td>${esc(m.from_method || "")}</td><td>${esc(m.to_method || "")}</td><td class="n">${kes(m.amount)}</td><td>${esc(m.notes || "")}</td><td>${edit && !["Asset purchase", "Asset sale"].includes(m.kind) ? `<button class="btn sm ghost" data-md="${m.id}">Delete</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7" style="color:var(--mut)">Nothing yet.</td></tr>`}</tbody></table></div></div>
    <div class="panel"><h3>Recent real counts</h3>${tbl(["Date", "Account", "Counted", "Note"], checks.map(c => [c.checked_on, c.method, Number(c.actual), c.note || ""]))}${edit ? "" : ""}</div>`;
  if (!edit) return;
  const dlgOpen = (title, body, fn) => { const f = $("#dlgForm"); f.oninput = f.onchange = f.onclick = null;
    f.innerHTML = `<h2>${title}</h2><div class="grid">${body}</div><div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
    f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const x = await fn(f.elements); if (x && x.error) return toast(x.error.message); $("#dlg").close(); toast("Saved"); moneyPage(); }; $("#dlg").showModal(); };
  const sel = (n, l, o) => `<label>${l}<select name="${n}">${(o || ["Cash", "M-Pesa", "Bank"]).map(m => `<option>${m}</option>`).join("")}</select></label>`;
  const dt = `<label>Date<input name="on" type="date" value="${iso(new Date())}" required></label>`, am = `<label>Amount (KES)<input name="am" type="number" min="0.01" step="0.01" required inputmode="decimal"></label>`, nt = `<label class="full">Note<input name="note"></label>`;
  const mv = (kind, el, extra = {}) => db.rpc("fund_move_add", { p_kind: kind, p_date: el.on.value, p_amount: Number(el.am.value), p_from: extra.from ?? null, p_to: extra.to ?? null, p_loan: extra.loan ?? null, p_notes: el.note.value.trim() || null });
  $("#view").onclick = async e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.o) { const a = acc.find(x => x.method === b.dataset.o);
      dlgOpen("Starting balance — " + a.method, `<label>Balance on the start date (KES)<input name="am" type="number" step="0.01" value="${esc(a.opening)}" required></label><label>Start date<input name="on" type="date" value="${esc(a.opening_date)}" required></label><p class="full" style="color:var(--mut);font-size:13px;margin:0">Money recorded before this date is ignored. Use the real balance on that date.</p>`, el => db.rpc("money_opening_set", { p_method: a.method, p_balance: Number(el.am.value), p_date: el.on.value })); }
    else if (b.dataset.c) dlgOpen("Real count — " + b.dataset.c, `${dt}<label>Counted / balance shown (KES)<input name="am" type="number" min="0" step="0.01" required inputmode="decimal"></label>${nt}<p class="full" style="color:var(--mut);font-size:13px;margin:0">Cash: count the drawer. M-Pesa: the till/business balance. Bank: the balance on your statement.</p>`, el => db.rpc("balance_check_add", { p_method: b.dataset.c, p_on: el.on.value, p_actual: Number(el.am.value), p_note: el.note.value.trim() || null }));
    else if (b.dataset.m === "Transfer") dlgOpen("Move money between accounts", `${dt}${am}${sel("from", "From")}${sel("to", "To", ["M-Pesa", "Cash", "Bank"])}${nt}`, el => el.from.value === el.to.value ? { error: { message: "Choose two different accounts." } } : mv("Transfer", el, { from: el.from.value, to: el.to.value }));
    else if (b.dataset.m === "Owner capital") dlgOpen("Owner puts money into the business", `${dt}${am}${sel("to", "Into")}${nt}`, el => mv("Owner capital", el, { to: el.to.value }));
    else if (b.dataset.m === "Owner drawings") dlgOpen("Owner takes money out", `${dt}${am}${sel("from", "From")}${nt}`, el => mv("Owner drawings", el, { from: el.from.value }));
    else if (b.id === "l_new") dlgOpen("Record a loan received", `<label class="full">Lender<input name="who" required placeholder="Bank, SACCO, person…"></label>${dt}${am}${sel("to", "Money went into")}<label>Due date (optional)<input name="due" type="date"></label>${nt}`, el => db.rpc("loan_add", { p_lender: el.who.value, p_date: el.on.value, p_principal: Number(el.am.value), p_to: el.to.value, p_due: el.due.value || null, p_notes: el.note.value.trim() || null }));
    else if (b.dataset.r) { const l = loans.find(x => String(x.id) === b.dataset.r); dlgOpen("Repay — " + esc(l.lender), `${dt}<label>Amount (KES) — owed ${kes(owed(l))}<input name="am" type="number" min="0.01" step="0.01" max="${owed(l)}" required value="${owed(l)}"></label>${sel("from", "Paid from")}${nt}`, el => mv("Loan repayment", el, { from: el.from.value, loan: l.id })); }
    else if (b.dataset.ld) { if (!confirm("Delete this loan and its repayments?")) return; const x = await db.rpc("loan_delete", { p_id: Number(b.dataset.ld) }); if (x.error) return toast(x.error.message); moneyPage(); }
    else if (b.dataset.md) { if (!confirm("Delete this money movement?")) return; const x = await db.rpc("fund_move_delete", { p_id: Number(b.dataset.md) }); if (x.error) return toast(x.error.message); moneyPage(); } };
}

// ---- report extras: charts and insights shown on End of day / Monthly / Year summary ---------------------------------
async function eodExtras(day) {
  if (!(can("reports.view+costs.view"))) return "";
  let r; try { r = await db.rpc("eod_insights", { d: day }); } catch (_) { return ""; } if (!r || r.error || !r.data) return "";
  const e = r.data, S = e.series || [], vs = (a, b) => Number(b) > 0 ? ` <span class="dl ${Number(a) >= Number(b) ? "up" : "dn"}">${Number(a) >= Number(b) ? "▲" : "▼"} ${Math.abs(Math.round((Number(a) - Number(b)) / Number(b) * 100))}%</span>` : "";
  const cl = e.closings || [], m = e.money;
  return `<div class="panel" id="eodx"><h3>How today compares</h3>
    <div class="cards"><div class="card"><small>Revenue today</small><b>KES ${kes(e.revenue)}</b></div><div class="card"><small>Yesterday</small><b>KES ${kes(e.yesterday)}</b>${vs(e.revenue, e.yesterday)}</div>
    <div class="card"><small>Typical ${new Date(day + "T12:00").toLocaleDateString("en-KE", { weekday: "long" })} (last 4)</small><b>KES ${kes(Math.round(e.weekday_avg))}</b>${vs(e.revenue, e.weekday_avg)}</div>
    <div class="card"><small>Month so far</small><b>KES ${kes(e.mtd)}</b>${vs(e.mtd, e.last_mtd)}<br><small>vs KES ${kes(e.last_mtd)} same days last month</small></div></div>
    <h4>Last 14 days</h4>${dayChart(S.map(x => ({ d: x.d, income: x.revenue, expenses: x.expenses })))}
    ${(e.lines || []).length ? `<h4>Where today's income came from</h4>${BRAND.donut((e.lines || []).map((x, i) => ({ n: x.line, v: Number(x.amount), c: PALETTE[i % PALETTE.length] })), "Today")}` : ""}
    ${cl.length > 1 ? `<h4>Cash drawer differences (recent closings)</h4>${fBars(cl.map(c => String(c.day).slice(5)), [{ n: "Difference", c: FC.blue, v: cl.map(c => c.variance) }], "Cash drawer difference at each recent closing")}<p style="color:var(--mut);font-size:13px">Red bars mean the drawer had less cash than expected.</p>` : ""}
    ${m ? `<h4>Money position at the end of ${esc(day)}</h4>${moneyCards(m)}` : ""}</div>`;
}
async function monthExtras(yr, mo) {
  const from = `${yr}-${String(mo).padStart(2, "0")}-01`, last = new Date(yr, mo, 0).getDate(), to = `${yr}-${String(mo).padStart(2, "0")}-${last}`;
  let i; try { i = await db.rpc("income_statement", { p_from: from, p_to: to }); } catch (_) { return { html: "", print: "" }; } if (!i || i.error || !i.data) return { html: "", print: "" };
  const s = i.data, ex = (s.expense_lines || []).map((x, k) => ({ l: x.category, v: Number(x.amount), c: PALETTE[k % PALETTE.length] })), rv = (s.revenue_lines || []).map((x, k) => ({ n: x.line, v: Number(x.amount), c: PALETTE[k % PALETTE.length] }));
  let ins = []; try { if (new Date().getFullYear() === yr && new Date().getMonth() + 1 === mo) ins = (await db.rpc("management_insights")).data || []; } catch (_) {}
  const stm = `<h3>Profit &amp; loss for the month</h3>${incomeStatementHtml(s)}`;
  return { print: stm, html: `<h3>Where the money came from</h3>${BRAND.donut(rv, "Revenue")}<h3>Where it went</h3>${hbars(ex.sort((a, b) => b.v - a.v))}
    <div class="cards"><div class="card"><small>Gross profit</small><b>KES ${fSign(s.gross_profit)}</b><br><small>margin ${fPct(s.gross_profit, s.revenue)}</small></div><div class="card"><small>Net profit</small><b style="${fTone(s.net_profit)}">KES ${fSign(s.net_profit)}</b><br><small>margin ${fPct(s.net_profit, s.revenue)}</small></div></div>${stm}${ins.length ? `<h3>Insights</h3>${insightList(ins)}` : ""}` };
}
async function yearExtras(yr) {
  const q = (a, b) => db.rpc("income_statement", { p_from: a, p_to: b });
  const months = Array.from({ length: 12 }, (_, k) => k + 1), now = new Date(), upto = now.getFullYear() === yr ? now.getMonth() + 1 : now.getFullYear() > yr ? 12 : 0;
  if (!upto) return { html: "", print: "" };
  let rs; try { rs = await Promise.all(months.slice(0, upto).map(m => q(`${yr}-${String(m).padStart(2, "0")}-01`, `${yr}-${String(m).padStart(2, "0")}-${new Date(yr, m, 0).getDate()}`))); } catch (_) { return { html: "", print: "" }; }
  if (rs.some(x => !x || x.error)) return { html: "", print: "" };
  const S = rs.map(x => x.data), whole = await q(`${yr}-01-01`, `${yr}-12-31`); if (!whole || whole.error) return { html: "", print: "" };
  const stm = `<h3>Profit &amp; loss for ${yr}</h3>${incomeStatementHtml(whole.data)}`;
  return { print: stm, html: `<h3>Profit by month</h3>${fBars(S.map((_, k) => MONTHS[k]), [{ n: "Net profit", c: FC.good, v: S.map(s => s.net_profit) }], "Net profit by month")}
    <h3>Revenue and costs by month</h3>${fBars(S.map((_, k) => MONTHS[k]), [{ n: "Revenue", c: FC.blue, v: S.map(s => s.revenue) }, { n: "Costs", c: FC.orange, v: S.map(s => Number(s.revenue) - Number(s.net_profit)) }], "Revenue and costs by month")}${stm}` };
}
