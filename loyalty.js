/* Franksomi Records – loyalty points and referral agents (v35). Loaded before app.js. */
const LY_PHONE = p => { const d = String(p || "").replace(/\D/g, ""); return /^(254|0)?[17]\d{8}$/.test(d) ? "254" + d.slice(-9) : ""; };
const lyShow = p => p ? "0" + p.slice(3, 6) + " " + p.slice(6, 9) + " " + p.slice(9) : "";
const lyMsg = e => (e && e.message) || "Something went wrong";

// ---------- Loyalty points ----------
async function loyaltyPage() {
  const st = (await db.rpc("loyalty_settings")).data || {}, rows = (await db.from("loyalty_members_v").select("*").order("last_at", { ascending: false, nullsFirst: false }).limit(2000)).data || [];
  const val = Number(st.value_kes || 1), live = rows.reduce((s, r) => s + Number(r.balance), 0);
  $("#view").innerHTML = `<h2>Loyalty points</h2>
    <p style="color:var(--mut);margin-top:0">${st.on ? `Customers earn <b>1 point for every KES ${kes(st.earn_kes)}</b> they pay, once a sale, shop order, repair or job is complete and fully paid (it needs the customer's mobile number). The points show on their receipt. Each point is worth <b>KES ${kes(val)}</b> off; at least <b>${st.min_points}</b> points are needed to redeem.` : `<b>Loyalty points are switched off.</b>`}</p>
    <div class="cards"><div class="card"><small>Members</small><b>${rows.length}</b></div><div class="card"><small>Points held</small><b>${live.toLocaleString("en-KE")}</b></div><div class="card"><small>Worth (what you owe in discounts)</small><b>KES ${kes(live * val)}</b></div></div>
    <div class="bar"><input id="lq" placeholder="Search name or phone" style="max-width:260px"><button class="btn" id="la">+ Award points for a sale</button><button class="btn ghost" id="lm">+ Add member</button>${can("loyalty.manage") ? `<button class="btn ghost" id="ls">Loyalty rules</button>` : ""}</div>
    <div class="wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th class="n">Points</th><th class="n">Worth KES</th><th class="n">Earned</th><th class="n">Redeemed</th><th>Last</th><th></th></tr></thead><tbody id="tb">
    ${rows.map((r, i) => `<tr><td>${esc(r.name || "")}</td><td>${esc(lyShow(r.phone))}</td><td class="n"><b>${r.balance}</b></td><td class="n">${kes(r.balance * val)}</td><td class="n">${r.earned}</td><td class="n">${r.redeemed}</td><td>${esc(String(r.last_at || "").slice(0, 10))}</td>
    <td style="white-space:nowrap"><button class="btn sm" data-rd="${i}" ${r.balance >= st.min_points && st.on ? "" : "disabled"}>Redeem</button> <button class="btn sm ghost" data-hi="${i}">History</button>${can("loyalty.manage") ? ` <button class="btn sm ghost" data-ad="${i}">Correct</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="8">No members yet. They are added when a customer with a mobile number pays, or press Add member.</td></tr>`}</tbody></table></div>`;
  $("#lq").oninput = e => { const t = e.target.value.toLowerCase().replace(/\s/g, ""); document.querySelectorAll("#tb tr").forEach(tr => tr.hidden = !tr.textContent.toLowerCase().replace(/\s/g, "").includes(t)); };
  $("#la").onclick = () => lyAward(); $("#lm").onclick = () => lyMember();
  if ($("#ls")) $("#ls").onclick = () => lyRules(st);
  $("#tb").onclick = e => { const b = e.target.closest("button"); if (!b) return; const r = rows[b.dataset.rd ?? b.dataset.hi ?? b.dataset.ad];
    if (b.dataset.rd) lyRedeem(r, st); else if (b.dataset.hi) lyHistory(r); else if (b.dataset.ad) lyAdjust(r); };
}
function lyAward() {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null;
  f.innerHTML = `<h2>Award points for a sale</h2><p style="margin-top:0;color:var(--mut)">Use this for walk-in sales. Orders, repairs and jobs award points by themselves.</p><div class="grid">
    <label>Customer phone<input name="phone" required inputmode="tel" placeholder="07XX XXX XXX"></label><label>Name<input name="name"></label>
    <label>Amount the customer paid (KES)<input name="amt" type="number" min="1" step="any" required></label><label>Note (sale / receipt number)<input name="ref" maxlength="60"></label></div>
    <p id="lmsg" class="msg"></p><div class="bar"><button class="btn" value="save">Award points</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const x = await db.rpc("loyalty_award", { p_phone: f.elements.phone.value, p_name: f.elements.name.value, p_amount: Number(f.elements.amt.value), p_ref: f.elements.ref.value });
    if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; }
    $("#dlg").close(); toast(`${x.data.points} points awarded. Balance ${x.data.balance}`); loyaltyPage(); };
  $("#dlg").showModal();
}
function lyMember() {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null;
  f.innerHTML = `<h2>Add a loyalty member</h2><div class="grid"><label>Phone<input name="phone" required inputmode="tel" placeholder="07XX XXX XXX"></label><label>Name<input name="name"></label><label class="full">Note<input name="note"></label></div>
    <p id="lmsg" class="msg"></p><div class="bar"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const x = await db.rpc("loyalty_member_save", { p_phone: f.elements.phone.value, p_name: f.elements.name.value, p_note: f.elements.note.value });
    if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; } $("#dlg").close(); toast("Saved"); loyaltyPage(); };
  $("#dlg").showModal();
}
function lyRules(st) {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null;
  f.innerHTML = `<h2>Loyalty rules</h2><div class="grid"><label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="on" ${st.on ? "checked" : ""} style="width:auto"> Loyalty points are on</label>
    <label>Customer spends KES … to earn 1 point<input name="earn" type="number" min="1" step="any" value="${Number(st.earn_kes)}"></label><label>1 point is worth KES …<input name="val" type="number" min="0.01" step="any" value="${Number(st.value_kes)}"></label>
    <label>Least points that can be redeemed<input name="min" type="number" min="0" step="1" value="${Number(st.min_points)}"></label></div>
    <p style="color:var(--mut)">Changes apply to new points. Points already earned keep their value at the time they are redeemed using the rule in force then.</p><p id="lmsg" class="msg"></p>
    <div class="bar"><button class="btn" value="save">Save rules</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const x = await db.rpc("loyalty_settings_set", { p: { on: f.elements.on.checked, earn_kes: String(f.elements.earn.value), value_kes: String(f.elements.val.value), min_points: String(f.elements.min.value) } });
    if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; } $("#dlg").close(); toast("Rules saved"); loyaltyPage(); };
  $("#dlg").showModal();
}
function lyRedeem(r, st) {
  const f = $("#dlgForm"), val = Number(st.value_kes || 1); f.onsubmit = f.oninput = f.onclick = null;
  f.innerHTML = `<h2>Redeem points – ${esc(r.name || lyShow(r.phone))}</h2><p style="margin-top:0">${r.balance} points (worth KES ${kes(r.balance * val)}).</p><div class="grid">
    <label>Points to redeem<input name="pts" type="number" min="${st.min_points}" max="${r.balance}" step="1" value="${r.balance}" required></label><label>Used on (sale / receipt, optional)<input name="ref" maxlength="60"></label></div>
    <p id="lval" style="font-weight:600"></p><p id="lmsg" class="msg"></p><div class="bar"><button class="btn" value="save">Redeem</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  const upd = () => { $("#lval").textContent = "Give the customer a discount of KES " + kes((Number(f.elements.pts.value) || 0) * val); }; f.oninput = upd; upd();
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const x = await db.rpc("loyalty_redeem", { p_phone: r.phone, p_points: Number(f.elements.pts.value), p_ref: f.elements.ref.value });
    if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; }
    const d = x.data; $("#dlg").close(); toast(`${d.voucher}: discount KES ${kes(d.value_kes)}. ${d.balance} points left`);
    printHtml(head("LOYALTY VOUCHER", d.voucher) + `<p><b>${esc(r.name || "Customer")}</b> · ${esc(lyShow(r.phone))}</p><p style="font-size:22px"><b>KES ${kes(d.value_kes)}</b> discount for ${d.points} points</p><p>Points left: ${d.balance}. Give this discount on the customer's purchase${f.elements.ref.value ? " (" + esc(f.elements.ref.value) + ")" : ""}. Date: ${iso(new Date())}.</p>`, d.voucher + " Loyalty voucher.pdf");
    loyaltyPage(); };
  $("#dlg").showModal();
}
async function lyHistory(r) {
  const q = await db.from("loyalty_ledger").select("*").eq("phone", r.phone).order("id", { ascending: false }).limit(200), rows = q.data || [], f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null;
  const done = new Set(rows.filter(x => x.reverses).map(x => x.reverses));
  f.innerHTML = `<h2>Points history – ${esc(r.name || lyShow(r.phone))}</h2><p style="margin-top:0">Balance ${r.balance} points.</p><div class="wrap"><table><thead><tr><th>Date</th><th>What</th><th class="n">Points</th><th class="n">KES</th><th>Note</th><th></th></tr></thead><tbody>
    ${rows.map(x => `<tr><td>${esc(String(x.at).slice(0, 10))}</td><td>${esc({ earn: "Earned", redeem: "Redeemed", adjust: "Correction", reverse: "Reversed" }[x.kind])}${x.ref ? " · " + esc(x.ref) : ""}</td><td class="n">${x.points > 0 ? "+" : ""}${x.points}</td><td class="n">${kes(x.value_kes)}</td><td>${esc(x.note || "")}</td>
    <td>${can("loyalty.manage") && ["earn", "redeem"].includes(x.kind) && !done.has(x.id) ? `<button type="button" class="btn sm ghost" data-rv="${x.id}">Reverse</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
    <div class="bar" style="margin-top:12px"><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
  f.onclick = async e => { const b = e.target.closest("[data-rv]"); if (!b) return; if (!confirm("Reverse this entry? The points go back the way they were.")) return;
    const x = await db.rpc("loyalty_reverse", { p_id: Number(b.dataset.rv), p_note: null }); if (x.error) return toast(lyMsg(x.error)); $("#dlg").close(); toast("Reversed"); loyaltyPage(); };
  $("#dlg").showModal();
}
function lyAdjust(r) {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null;
  f.innerHTML = `<h2>Correct points – ${esc(r.name || lyShow(r.phone))}</h2><p style="margin-top:0">Now ${r.balance} points.</p><div class="grid"><label>Points to add (use a minus to take off)<input name="pts" type="number" step="1" required></label><label>Why<input name="why" required></label></div>
    <p id="lmsg" class="msg"></p><div class="bar"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const x = await db.rpc("loyalty_adjust", { p_phone: r.phone, p_points: Number(f.elements.pts.value), p_note: f.elements.why.value });
    if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; } $("#dlg").close(); toast("Balance now " + x.data.balance); loyaltyPage(); };
  $("#dlg").showModal();
}

// ---------- Referral agents ----------
const agRule = a => a.mode === "percent" ? `${Number(a.rate)}% of sales` : a.mode === "profit" ? `${Number(a.rate)}% of profit` : `Tiered on ${a.basis}: ` + (a.tiers || []).map(t => `from ${kes(t.from)} → ${Number(t.rate)}%`).join(", ");
async function agentsPage() {
  const rows = (await db.from("agents_v").select("*").order("name")).data || [], st = (await db.rpc("loyalty_settings")).data || {}, M = can("agents.manage");
  const owed = rows.reduce((s, a) => s + Number(a.owed), 0);
  $("#view").innerHTML = `<h2>Referral agents</h2><p style="color:var(--mut);margin-top:0">Agents bring customers. The agent earns commission by the agent's rule when a sale, shop order, repair or job that came with the agent's referral code (or from a customer the agent referred) is complete and fully paid. ${Number(st.agent_window_months) ? `A referral earns for <b>${st.agent_window_months} months</b>.` : "A referral earns for ever."}</p>
    <div class="cards"><div class="card"><small>Agents</small><b>${rows.filter(a => a.active).length}</b></div><div class="card"><small>Commission owed</small><b>KES ${kes(owed)}</b></div><div class="card"><small>Paid so far</small><b>KES ${kes(rows.reduce((s, a) => s + Number(a.paid), 0))}</b></div></div>
    ${M ? `<div class="bar"><button class="btn" id="an">+ New agent</button><button class="btn ghost" id="aw">Referral period</button></div>` : ""}
    <div class="wrap"><table><thead><tr><th>Referral code</th><th>Agent</th><th>Commission rule</th><th class="n">Customers</th><th class="n">Sales</th><th class="n">Owed</th><th class="n">Paid</th><th></th></tr></thead><tbody id="tb">
    ${rows.map((a, i) => `<tr><td><b>${esc(a.ref_code)}</b><br><small>${esc(a.code)}</small></td><td>${esc(a.name)}${a.active ? "" : ' <span class="tag bad">Off</span>'}<br><small>${esc(lyShow(a.phone || ""))}</small></td><td>${esc(agRule(a))}</td><td class="n">${a.customers}</td><td class="n">${kes(a.sales)}</td><td class="n"><b>${kes(a.owed)}</b></td><td class="n">${kes(a.paid)}</td>
    <td style="white-space:nowrap"><button class="btn sm ghost" data-sh="${i}">Share code</button> <button class="btn sm ghost" data-cu="${i}">Customers</button> <button class="btn sm ghost" data-co="${i}">Commission</button>${M ? ` <button class="btn sm ghost" data-ed="${i}">Edit</button> <button class="btn sm ghost" data-pr="${i}" title="Let this agent look up selling prices on the agent page">Prices: ${a.can_check_prices ? "on" : "off"}</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="8">No agents yet.</td></tr>`}</tbody></table></div>`;
  if ($("#an")) $("#an").onclick = () => agForm(null); if ($("#aw")) $("#aw").onclick = () => agWindow(st);
  $("#tb").onclick = e => { const b = e.target.closest("button"); if (!b) return; const a = rows[b.dataset.sh ?? b.dataset.cu ?? b.dataset.co ?? b.dataset.ed ?? b.dataset.pr]; if (b.dataset.pr) { db.rpc("agent_set_prices", { p_id: a.id, p_on: !a.can_check_prices }).then(x => { if (x.error) toast(lyMsg(x.error)); else { toast(a.can_check_prices ? "Price check switched off for " + a.name : a.name + " can now check prices"); agentsPage(); } }); return; } if (b.dataset.sh) agShare(a); else if (b.dataset.cu) agCustomers(a); else if (b.dataset.co) agCommission(a); else if (b.dataset.ed) agForm(a); };
}
// the agent's referral code, link and a ready message to send; a card to print or hand over; change the code
function agShare(a) {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null; const M = can("agents.manage");
  const base = (window.APP_CONFIG && APP_CONFIG.SITE_URL ? APP_CONFIG.SITE_URL : "https://" + SHOP.web + "/").replace(/\/?$/, "/"), link = base + "shop.html?ref=" + encodeURIComponent(a.ref_code), stmt = base + "agent.html";
  const msg = `Hello! Use my Franksomi referral code ${a.ref_code} when you buy, book a repair or ask for an installation. Shop and order online: ${link}  ·  Call ${SHOP.phone}.`;
  f.innerHTML = `<h2>Referral code for ${esc(a.name)}</h2><p style="font-size:1.6em;margin:6px 0"><b style="letter-spacing:.08em">${esc(a.ref_code)}</b></p>
    <p style="color:var(--mut)">A customer gives this code when they buy, book a repair or start a job. Staff type it on the sale, repair or job; online customers type it at checkout, or arrive by the link below (it is remembered for 60 days).</p>
    <label>Link to share<input readonly id="shl" value="${esc(link)}"></label><label>Message to send<textarea readonly id="shm" rows="3">${esc(msg)}</textarea></label>
    <p style="color:var(--mut)"><small>The agent can see their own leads and commission at <b>${esc(stmt)}</b> with the code and phone number registered for them.</small></p>
    <div class="bar"><button type="button" class="btn" id="shc">Copy message</button><a class="btn ghost" id="shw" target="_blank" rel="noopener" href="https://wa.me/${esc(a.phone || "")}?text=${encodeURIComponent(msg)}">Send on WhatsApp</a><button type="button" class="btn ghost" id="shp">Print agent card</button>${M ? '<button type="button" class="btn ghost" id="shx">Change code</button>' : ""}<button class="btn ghost" value="cancel" formnovalidate>Close</button></div><p id="lmsg" class="msg"></p>`;
  f.onclick = async e => {
    if (e.target.id === "shc") { try { await navigator.clipboard.writeText(msg); toast("Copied"); } catch (_) { $("#shm").select(); toast("Press Ctrl+C to copy"); } }
    if (e.target.id === "shp") printHtml(head("REFERRAL AGENT CARD", a.code) + kv([["Agent", a.name], ["Referral code", a.ref_code], ["How it works", "Give this code when you buy, book a repair or start an installation. Online: shop.html?ref=" + a.ref_code], ["Your statement", stmt], ["Contact", SHOP.phone + " · " + SHOP.email]]) + `<p style="font-size:28px;text-align:center;margin:18px 0"><b style="letter-spacing:.1em">${esc(a.ref_code)}</b></p>`, a.ref_code + " agent card.pdf");
    if (e.target.id === "shx") { const c = prompt("New referral code (4 to 12 letters or numbers):", a.ref_code); if (!c) return; const x = await db.rpc("agent_set_code", { p_id: a.id, p_code: c }); if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; } $("#dlg").close(); toast("Code is now " + x.data.code); agentsPage(); }
  };
  $("#dlg").showModal();
}
function agWindow(st) {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null;
  f.innerHTML = `<h2>Referral period</h2><label>How many months does a referred customer earn commission for? (0 = for ever)<input name="m" type="number" min="0" step="1" value="${Number(st.agent_window_months)}"></label><p id="lmsg" class="msg"></p>
    <div class="bar"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const x = await db.rpc("loyalty_settings_set", { p: { agent_window_months: String(f.elements.m.value) } });
    if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; } $("#dlg").close(); toast("Saved"); agentsPage(); };
  $("#dlg").showModal();
}
function agForm(a) {
  const f = $("#dlgForm"), tiers = a && a.mode === "tiered" ? a.tiers.map(t => ({ ...t })) : [{ from: 0, rate: 3 }, { from: 50000, rate: 5 }]; f.onsubmit = f.oninput = f.onclick = null;
  const tierRows = () => tiers.map((t, i) => `<div class="bar" style="margin:4px 0"><label>From KES<input type="number" data-tf="${i}" min="0" step="any" value="${Number(t.from)}" ${i === 0 ? "readonly" : ""} style="width:130px"></label><label>Rate %<input type="number" data-tr="${i}" min="0" max="100" step="any" value="${Number(t.rate)}" style="width:90px"></label>${i ? `<button type="button" class="btn sm ghost" data-tx="${i}">Remove</button>` : ""}</div>`).join("");
  f.innerHTML = `<h2>${a ? "Edit agent " + esc(a.code) : "New agent"}</h2><div class="grid"><label>Name<input name="name" required value="${esc(a ? a.name : "")}"></label><label>Phone<input name="phone" inputmode="tel" value="${esc(a ? lyShow(a.phone || "") : "")}"></label>
    <label>Email<input name="email" type="email" value="${esc(a ? a.email || "" : "")}"></label>
    <label>How the agent is paid<select name="mode"><option value="percent">Percentage of the sale</option><option value="profit">Percentage of the profit</option><option value="tiered">Tiered (rate rises with the month's total)</option></select></label>
    <label id="rt">Rate %<input name="rate" type="number" min="0" max="100" step="any" value="${a ? Number(a.rate) : 5}"></label>
    <div class="full" id="tr" hidden><label>Tiers count the month's<select name="basis"><option value="sales">sales</option><option value="profit">profit</option></select></label><div id="trows"></div><button type="button" class="btn sm ghost" id="tadd">+ Add tier</button>
      <p style="color:var(--mut);margin:6px 0 0"><small>Each slice of the month's total earns its own rate. For example 0% … 3%, from 50,000 … 5%: a month of 60,000 pays 3% on the first 50,000 and 5% on the last 10,000.</small></p></div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" ${!a || a.active ? "checked" : ""} style="width:auto"> Active</label><label class="full">Note<input name="note" value="${esc(a ? a.note || "" : "")}"></label></div>
    <p id="lmsg" class="msg"></p><div class="bar"><button class="btn" value="save">Save agent</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.elements.mode.value = a ? a.mode : "percent"; if (a && a.mode === "tiered") f.elements.basis.value = a.basis;
  const sync = () => { const t = f.elements.mode.value === "tiered"; $("#tr").hidden = !t; $("#rt").hidden = t; $("#rt").firstChild.textContent = f.elements.mode.value === "profit" ? "Rate % of profit" : "Rate % of sale"; $("#trows").innerHTML = tierRows(); }; sync();
  f.onchange = e => { if (e.target.name === "mode") sync(); if (e.target.dataset.tf !== undefined) tiers[e.target.dataset.tf].from = Number(e.target.value); if (e.target.dataset.tr !== undefined) tiers[e.target.dataset.tr].rate = Number(e.target.value); };
  f.onclick = e => { if (e.target.id === "tadd") { tiers.push({ from: (Number(tiers[tiers.length - 1].from) || 0) + 50000, rate: Number(tiers[tiers.length - 1].rate) + 2 }); sync(); } if (e.target.dataset.tx) { tiers.splice(Number(e.target.dataset.tx), 1); sync(); } };
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const x = await db.rpc("agent_save", { p_id: a ? a.id : null, p_name: f.elements.name.value, p_phone: f.elements.phone.value, p_email: f.elements.email.value, p_mode: f.elements.mode.value, p_rate: Number(f.elements.rate.value) || 0, p_tiers: tiers, p_basis: f.elements.basis.value, p_active: f.elements.active.checked, p_note: f.elements.note.value });
    if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; } $("#dlg").close(); toast("Saved " + x.data.code); agentsPage(); };
  $("#dlg").showModal();
}
async function agCustomers(a) {
  const rows = (await db.from("agent_referrals").select("*").eq("agent_id", a.id).order("referred_on", { ascending: false })).data || [], f = $("#dlgForm"), M = can("agents.manage"); f.onsubmit = f.oninput = f.onclick = null;
  f.innerHTML = `<h2>Customers referred by ${esc(a.name)}</h2><div class="wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Referred</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.name || "")}</td><td>${esc(lyShow(r.phone))}</td><td>${esc(r.referred_on)}</td><td>${M ? `<button type="button" class="btn sm ghost" data-rm="${esc(r.phone)}">Remove</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="4">None yet.</td></tr>`}</tbody></table></div>
    ${M && a.active ? `<h3>Add a referred customer</h3><div class="grid"><label>Phone<input name="phone" inputmode="tel" placeholder="07XX XXX XXX"></label><label>Name<input name="name"></label></div><p id="lmsg" class="msg"></p><button type="button" class="btn sm" id="radd">Add customer</button>` : ""}
    <div class="bar" style="margin-top:12px"><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
  f.onclick = async e => { const b = e.target.closest("[data-rm]"), add = e.target.id === "radd"; if (!b && !add) return;
    const x = b ? await db.rpc("agent_unrefer", { p_phone: b.dataset.rm }) : await db.rpc("agent_refer", { p_agent: a.id, p_phone: f.elements.phone.value, p_name: f.elements.name.value, p_note: null });
    if (x.error) { if ($("#lmsg")) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); } else toast(lyMsg(x.error)); return; } $("#dlg").close(); await agentsPage(); agCustomers((await db.from("agents_v").select("*").eq("id", a.id).single()).data || a); };
  $("#dlg").showModal();
}
async function agCommission(a) {
  const rows = (await db.from("agent_commissions").select("*").eq("agent_id", a.id).order("id", { ascending: false }).limit(300)).data || [], f = $("#dlgForm"), M = can("agents.manage"), owed = rows.filter(r => r.status === "Accrued").reduce((s, r) => s + Number(r.amount), 0); f.onsubmit = f.oninput = f.onclick = null;
  const src = { order: "Shop order", repair: "Repair", job: "Job", sale: "Sale", manual: "Entered by hand" };
  f.innerHTML = `<h2>Commission – ${esc(a.name)} (${esc(a.code)})</h2><p style="margin-top:0">${esc(agRule(a))} · <b>owed KES ${kes(owed)}</b></p><div class="wrap"><table><thead><tr><th>Date</th><th>For</th><th class="n">Sale</th><th class="n">Profit</th><th class="n">Rate</th><th class="n">Commission</th><th>Status</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.earned_on)}</td><td>${esc(src[r.source] || r.source)}${r.ref ? " " + esc(r.ref) : ""}</td><td class="n">${kes(r.revenue)}</td><td class="n">${r.profit == null ? "" : kes(r.profit)}</td><td class="n">${Number(r.rate)}%</td><td class="n">${kes(r.amount)}</td><td><span class="tag ${r.status === "Paid" ? "ok" : r.status === "Void" ? "bad" : ""}">${r.status}</span></td>
    <td>${M && r.status === "Accrued" ? `<button type="button" class="btn sm ghost" data-vd="${r.id}">Void</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="8">No commission yet.</td></tr>`}</tbody></table></div>
    ${M ? `<h3>Pay the agent</h3><div class="grid"><label>Paid by<select name="pm"><option>M-Pesa</option><option>Cash</option><option>Bank</option></select></label><label>M-Pesa code / reference<input name="pref" maxlength="40"></label></div>
    <div class="bar"><button type="button" class="btn" id="apay" ${owed > 0 ? "" : "disabled"}>Pay KES ${kes(owed)}</button><button type="button" class="btn ghost" id="asale">+ Sale not captured</button><button type="button" class="btn ghost" id="aprint">Print statement</button></div>` : `<div class="bar"><button type="button" class="btn ghost" id="aprint">Print statement</button></div>`}
    <p id="lmsg" class="msg"></p><div class="bar" style="margin-top:6px"><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
  const again = async () => { $("#dlg").close(); await agentsPage(); agCommission((await db.from("agents_v").select("*").eq("id", a.id).single()).data || a); };
  f.onclick = async e => { const t = e.target;
    if (t.dataset.vd) { const why = prompt("Why is this commission cancelled?"); if (why === null) return; const x = await db.rpc("agent_void", { p_id: Number(t.dataset.vd), p_note: why }); return x.error ? toast(lyMsg(x.error)) : again(); }
    if (t.id === "apay") { if (!confirm(`Pay ${a.name} KES ${kes(owed)}? It is recorded under Expenses.`)) return; const x = await db.rpc("agent_pay", { p_agent: a.id, p_ids: null, p_method: f.elements.pm.value, p_ref: f.elements.pref.value || null, p_date: null });
      if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; } toast(`Paid KES ${kes(x.data.amount)} to ${a.name}`); return again(); }
    if (t.id === "asale") { const amt = Number(prompt("Sale amount (KES)")); if (!(amt > 0)) return; let prof = null; if (a.mode === "profit" || (a.mode === "tiered" && a.basis === "profit")) { prof = Number(prompt("Profit on the sale (KES)")); if (!(prof >= 0)) return; }
      const x = await db.rpc("agent_sale", { p_agent: a.id, p_phone: null, p_revenue: amt, p_profit: prof, p_date: null, p_ref: prompt("Note (receipt number, optional)") || null }); if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = lyMsg(x.error); return; } toast("Commission KES " + kes(x.data.amount)); return again(); }
    if (t.id === "aprint") printHtml(head("AGENT COMMISSION STATEMENT", a.code) + `<p><b>${esc(a.name)}</b> · ${esc(lyShow(a.phone || ""))}<br>Rule: ${esc(agRule(a))}<br>Printed ${iso(new Date())}</p>` + tbl(["Date", "For", "Sale", "Commission", "Status"], rows.filter(r => r.status !== "Void").map(r => [r.earned_on, (src[r.source] || r.source) + (r.ref ? " " + r.ref : ""), Number(r.revenue), Number(r.amount), r.status]), ["Owed (not yet paid)", "", "", owed, ""]), a.code + " commission statement.pdf"); };
  $("#dlg").showModal();
}
