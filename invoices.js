/* Franksomi Records – invoice payments and unpaid invoices (v29). Loaded before app.js. */
const IV_AGES = [["0–30 days", 0, 30, "#12b76a"], ["31–60 days", 31, 60, "#f79009"], ["61–90 days", 61, 90, "#f04438"], ["Over 90 days", 91, 1e9, "#7a271a"]];
async function invBalances() {   // id -> balance row; empty when the database has not been upgraded yet
  try { const r = await db.rpc("invoice_balances"); if (r.error || !Array.isArray(r.data)) return {}; const m = {}; r.data.forEach(b => m[b.id] = b); return m; } catch (e) { return {}; }
}
const ivTag = b => !b ? "" : b.status === "Paid" ? `<span class="tag ok">Paid</span>` : b.status === "Part paid" ? `<span class="tag draft">Part paid · KES ${kes(b.balance)} left</span>` : `<span class="tag bad">Unpaid · KES ${kes(b.balance)}</span>`;

function invPayDialog(b, after) {
  const f = $("#dlgForm"), today = iso(new Date());
  f.innerHTML = `<h2>Record payment – ${esc(b.doc_no)}</h2>
    <p style="margin-top:0">${esc(b.customer || "")} · invoice total KES ${kes(b.total)} · still to pay <b>KES ${kes(b.balance)}</b>${b.account_id ? `<br><small>This invoice is billed to credit account <b>${esc(b.account_name || "")}</b>: the payment goes onto that account's statement.</small>` : ""}</p>
    <div class="grid"><label>Amount received (KES)<input name="amt" type="number" step="0.01" min="0.01" max="${Number(b.balance)}" value="${Number(b.balance)}" required></label>
    <label>Date received<input name="dt" type="date" value="${today}" max="${today}" required></label>
    <label>How it was paid<select name="m"><option>Cash</option><option>M-Pesa</option><option>Bank</option></select></label>
    <label>M-Pesa code / bank reference<input name="ref" maxlength="40" autocomplete="off"></label>
    <label style="grid-column:1/-1">Note (optional)<input name="note" maxlength="200" autocomplete="off"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save payment</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const x = await db.rpc("invoice_pay", { p_doc: b.id, p_amount: Number(f.elements.amt.value), p_method: f.elements.m.value, p_date: f.elements.dt.value || null, p_ref: f.elements.ref.value.trim() || null, p_note: f.elements.note.value.trim() || null });
    if (x.error) return toast(x.error.message);
    $("#dlg").close(); toast(x.data.status === "Paid" ? `${x.data.doc_no} is paid in full` : `Saved. KES ${kes(x.data.balance)} still to pay on ${x.data.doc_no}`); if (after) after(); };
  $("#dlg").showModal();
}

// v34: put an older invoice that is not fully paid (imported history, or issued before the account existed) onto a credit account for what is still owing
async function invChargeDialog(b, after) {
  const q = await db.from("credit_accounts").select("id,name,active").order("name"), accs = (q.data || []).filter(a => a.active !== false), f = $("#dlgForm");
  f.innerHTML = `<h2>Charge to a credit account – ${esc(b.doc_no)}</h2>
    <p style="margin-top:0">${esc(b.customer || "")} · invoice dated ${esc(b.doc_date || "")} · total KES ${kes(b.total)}<br><small>This puts the amount still owing on the account's statement as a charge dated the invoice date, so the customer can see it and your payments on the account settle it, oldest first. Nothing is added to income or sales. Credit limits do not block it, because the money is already owed.</small></p>
    <div class="grid"><label>Credit account<select name="acc" ${b.account_id ? "disabled" : ""} required><option value="">Choose…</option>${accs.map(a => `<option value="${a.id}" ${Number(b.account_id) === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
    <label>Still owing on this invoice (KES)<input name="owing" type="number" step="0.01" min="0.01" max="${Number(b.total)}" value="${Number(b.balance)}" required></label></div>
    <p style="color:var(--mut);margin:8px 0 0"><small>If part of it was paid long ago, lower the amount to what is still unpaid. The rest is recorded as paid before the account.</small></p>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Charge to account</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const acc = Number(b.account_id || f.elements.acc.value); if (!acc) return toast("Choose the credit account");
    const x = await db.rpc("invoice_charge_old", { p_doc: b.id, p_account: acc, p_owing: Number(f.elements.owing.value) });
    if (x.error) return toast(x.error.message);
    $("#dlg").close(); toast(`KES ${kes(x.data.owing)} for ${x.data.doc_no} is now on ${x.data.account}'s account` + (x.data.over_limit ? ". Note: the account is now over its credit limit." : "")); if (after) after(); };
  $("#dlg").showModal();
}

async function invPaymentsDialog(b, after) {
  const q = await db.from("invoice_payments").select("*").eq("doc_id", b.id).order("paid_on", { ascending: true }).order("id", { ascending: true });
  const rows = q.data || [], f = $("#dlgForm");
  f.innerHTML = `<h2>Payments – ${esc(b.doc_no)}</h2><p style="margin-top:0">${esc(b.customer || "")} · total KES ${kes(b.total)}${Number(b.paid_before) ? ` · paid before invoicing KES ${kes(b.paid_before)}` : ""} · paid KES ${kes(b.paid)} · <b>left KES ${kes(b.balance)}</b></p>
    <div class="wrap"><table><thead><tr><th>Date</th><th class="n">Amount</th><th>How</th><th>Reference</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(p => `<tr><td>${esc(p.paid_on)}</td><td class="n">${kes(p.amount)}</td><td>${esc(p.method || "")}</td><td>${esc(p.mpesa_ref || "")}</td><td>${esc(p.note || "")}${p.linked ? ` <span class="tag imp">Matched</span>` : ""}</td><td>${can("docs.void") ? `<button class="btn sm warn" type="button" data-del="${p.id}" data-l="${p.linked ? 1 : 0}">Delete</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6">No payments recorded.</td></tr>`}</tbody></table></div>
    <p style="color:var(--mut);margin:8px 0 0"><small>Deleting a payment takes it back: the income or account payment it created is removed too. A <i>Matched</i> payment only loses its link to this invoice; the account payment stays.</small></p>
    <div class="bar" style="margin-top:14px"><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
  f.onsubmit = () => {};
  f.onclick = async e => { const t = e.target.closest("button[data-del]"); if (!t) return;
    if (!confirm(t.dataset.l === "1" ? "Remove the link between this payment and the invoice? The account payment stays." : "Delete this payment? The income or account payment it recorded is deleted too.")) return;
    const x = await db.rpc("invoice_payment_delete", { p_id: Number(t.dataset.del) }); if (x.error) return toast(x.error.message);
    $("#dlg").close(); toast("Payment removed"); if (after) after(); };
  $("#dlg").showModal();
}

async function unpaidPage() {
  const st = { q: "", s: "", imp: false, acc: "" };
  let all = [], un = [];
  const load = async () => {
    const r = await db.rpc("invoice_balances"); if (r.error) { $("#view").innerHTML = `<h2>Unpaid invoices</h2><p>${esc(r.error.message)}<br>Run <b>17_v28_to_v29.sql</b> in Supabase first.</p>`; return false; }
    all = r.data || []; un = []; if (can("docs.void")) { const u = await db.rpc("invoice_unmatched"); un = u.error ? [] : (u.data || []); } return true;
  };
  if (!await load()) return;
  const open = () => all.filter(b => Number(b.balance) > 0.005 && (st.imp || b.origin !== "import"));
  const shown = () => { const q = st.q.toLowerCase(); return open().filter(b => (!st.s || b.status === st.s) && (!st.acc || (st.acc === "credit" ? b.account_id : !b.account_id)) && (!q || [b.doc_no, b.customer, b.lpo_no, b.etims_no, b.account_name].join(" ").toLowerCase().includes(q))).sort((a, b) => b.age_days - a.age_days || a.id - b.id); };
  const totals = rows => { const owed = rows.reduce((s, b) => s + Number(b.balance), 0); return { owed, n: rows.length, part: rows.filter(b => b.status === "Part paid").length, old: rows.filter(b => b.age_days > 30).reduce((s, b) => s + Number(b.balance), 0), oldest: rows.reduce((m, b) => Math.max(m, b.age_days), 0) }; };
  const agingBar = rows => { const t = rows.reduce((s, b) => s + Number(b.balance), 0) || 1;
    return `<div style="display:flex;height:16px;border-radius:8px;overflow:hidden;background:var(--line,#eee);margin:10px 0 4px">${IV_AGES.map(([n, lo, hi, c]) => { const v = rows.filter(b => b.age_days >= lo && b.age_days <= hi).reduce((s, b) => s + Number(b.balance), 0); return v ? `<div title="${n}: KES ${kes(v)}" style="width:${v / t * 100}%;background:${c}"></div>` : ""; }).join("")}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:.85rem">${IV_AGES.map(([n, lo, hi, c]) => { const v = rows.filter(b => b.age_days >= lo && b.age_days <= hi).reduce((s, b) => s + Number(b.balance), 0); return `<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c};margin-right:5px"></i>${n}: <b>KES ${kes(v)}</b></span>`; }).join("")}</div>`; };
  const draw = () => {
    const rows = shown(), t = totals(open()), tv = totals(rows);
    $("#uc").innerHTML = `<div class="cards"><div class="card"><small>Owed to us on invoices</small><b>KES ${kes(t.owed)}</b><br><small>${t.n} invoice(s)${t.part ? `, ${t.part} part paid` : ""}</small></div>
      <div class="card"><small>Older than 30 days</small><b style="color:${t.old ? "#b42318" : "inherit"}">KES ${kes(t.old)}</b><br><small>${t.oldest ? `oldest is ${t.oldest} days` : "nothing outstanding"}</small></div></div>${agingBar(open())}
      ${un.length ? `<div class="card" style="margin:12px 0;border-left:4px solid #f79009"><b>Payments not yet tied to an invoice</b><br><small>These credit accounts have payments on their statement while invoices are still open. Match them to settle the oldest invoices first (no new money is recorded).</small>
        <table style="margin-top:6px"><tbody>${un.map(u => `<tr><td>${esc(u.account_name)}</td><td class="n">KES ${kes(u.unmatched)} paid</td><td>${u.open_invoices} open invoice(s), KES ${kes(u.open_balance)}</td><td><button class="btn sm" data-m="${u.account_id}">Match to invoices</button></td></tr>`).join("")}</tbody></table></div>` : ""}`;
    $("#ub").innerHTML = rows.map((b, i) => `<tr><td><b>${esc(b.doc_no)}</b>${b.origin === "import" ? ` <span class="tag imp">Imported</span>` : ""}${b.opened ? ` <span class="tag ok">On account</span>` : ""}</td><td>${esc(b.doc_date || "")}</td><td>${esc(b.customer || "")}${b.account_name ? `<br><small>Account: ${esc(b.account_name)}</small>` : ""}${b.lpo_no ? `<br><small>LPO ${esc(b.lpo_no)}</small>` : ""}</td>
      <td class="n">${kes(b.total)}</td><td class="n">${kes(Number(b.paid) + Number(b.paid_before))}</td><td class="n"><b>${kes(b.balance)}</b></td><td>${b.age_days} d</td><td><span class="tag ${b.status === "Part paid" ? "draft" : "bad"}">${b.status}</span></td>
      <td class="acts">${can("docs.view") && can(b.account_id ? "accounts.edit" : "income.add") ? `<button class="btn sm" data-pay="${i}">Record payment</button>` : ""} ${Number(b.paid) > 0 ? `<button class="btn sm ghost" data-pl="${i}">Payments</button>` : ""} ${b.charged === false && Number(b.paid) === 0 && can("accounts.edit") ? `<button class="btn sm ghost" data-ch="${i}">Charge to account</button>` : ""} ${b.opened && can("docs.void") && can("accounts.edit") ? `<button class="btn sm ghost" data-un="${i}">Take off account</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="9">Nothing matches — no unpaid invoices here.</td></tr>`;
    $("#ucnt").textContent = `${rows.length} invoice(s) · KES ${kes(tv.owed)}`;
    $("#ub").dataset.rows = ""; draw.rows = rows;
  };
  $("#view").innerHTML = `<h2>Unpaid invoices</h2>
    <p style="color:var(--mut);margin:0 0 8px">Every issued invoice that has not been paid in full, oldest first. Ageing counts from the invoice date because invoices carry no due date.</p>
    <div id="uc"></div>
    <div class="bar" style="margin-top:12px"><input id="uq" placeholder="Search invoice, customer, LPO…" style="max-width:260px"><select id="us"><option value="">Unpaid and part paid</option><option>Unpaid</option><option>Part paid</option></select>
      <select id="ua"><option value="">All customers</option><option value="credit">Credit accounts</option><option value="other">Other customers</option></select>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ui" style="width:auto"> include imported history</label><span id="ucnt" style="color:var(--mut)"></span>
      <button class="btn ghost" id="up">Print / PDF</button></div>
    <div class="wrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th class="n">Total</th><th class="n">Paid</th><th class="n">Left to pay</th><th>Age</th><th>Status</th><th></th></tr></thead><tbody id="ub"></tbody></table></div>`;
  const again = async () => { await load(); draw(); };
  draw();
  $("#uq").oninput = e => { st.q = e.target.value; draw(); }; $("#us").onchange = e => { st.s = e.target.value; draw(); }; $("#ua").onchange = e => { st.acc = e.target.value; draw(); }; $("#ui").onchange = e => { st.imp = e.target.checked; draw(); };
  $("#ub").onclick = e => { const b = e.target.closest("button"); if (!b) return; const D = b.dataset;
    if (D.pay) invPayDialog(draw.rows[D.pay], again); else if (D.pl) invPaymentsDialog(draw.rows[D.pl], again);
    else if (D.ch) invChargeDialog(draw.rows[D.ch], again);
    else if (D.un) { const r = draw.rows[D.un]; if (!confirm(`Take ${r.doc_no} off the account? The charge is removed from the statement and the invoice goes back as it was.`)) return;
      db.rpc("invoice_charge_old_undo", { p_doc: r.id }).then(x => { if (x.error) return toast(x.error.message); toast(`${x.data.doc_no} taken off the account`); again(); }); } };
  $("#uc").onclick = async e => { const b = e.target.closest("button[data-m]"); if (!b) return;
    if (!confirm("Match this account's earlier payments to its open invoices, oldest first? No new money is recorded; you can undo a match from the invoice's Payments button.")) return;
    const x = await db.rpc("invoice_match", { p_account: Number(b.dataset.m) }); if (x.error) return toast(x.error.message); toast(x.data.matched ? `Matched ${x.data.matched} payment(s), KES ${kes(x.data.amount)}` : "Nothing to match"); again(); };
  $("#up").onclick = () => { const rows = shown(), t = totals(rows);
    printHtml(head("UNPAID INVOICES", iso(new Date())) + `<p>Invoices not paid in full, oldest first. Total outstanding <b>KES ${kes(t.owed)}</b> on ${t.n} invoice(s).</p><table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Left to pay</th><th>Age</th></tr></thead><tbody>${rows.map(b => `<tr><td>${esc(b.doc_no)}</td><td>${esc(b.doc_date || "")}</td><td>${esc(b.customer || "")}${b.account_name ? " (" + esc(b.account_name) + ")" : ""}</td><td style="text-align:right">${kes(b.total)}</td><td style="text-align:right">${kes(Number(b.paid) + Number(b.paid_before))}</td><td style="text-align:right"><b>${kes(b.balance)}</b></td><td>${b.age_days} d</td></tr>`).join("")}</tbody><tfoot><tr><th colspan="5" style="text-align:right">Total outstanding</th><th style="text-align:right">${kes(t.owed)}</th><th></th></tr></tfoot></table>`, "Unpaid invoices " + iso(new Date()) + ".pdf"); };
}
