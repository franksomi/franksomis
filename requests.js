/* Franksomi Records – customer requests (v40): items or services customers asked for that we cannot supply yet. Loaded after loyalty.js, before app.js. */
const RQ_ST = ["Open", "Notified", "Converted", "Closed"];
const rqMsg = e => (e && e.message) || "Something went wrong";
const rqDay = t => String(t || "").slice(0, 10);

async function requestsPage(filter) {
  const E = can("requests.edit");
  const all = (await db.from("customer_requests").select("*").order("id", { ascending: false }).limit(1000)).data || [];
  let mt = []; try { mt = (await db.rpc("request_matches")).data || []; } catch (_) {}
  const match = new Map(mt.map(x => [x.id, x.matches])), live = r => r.status === "Open" || r.status === "Notified";
  const flt = filter || window.__rqf || "live"; window.__rqf = flt;
  const rows = all.filter(r => flt === "all" ? true : flt === "live" ? live(r) : flt === "ready" ? live(r) && match.has(r.id) : r.status === flt);
  const held = all.filter(r => r.deposit_status === "Held").reduce((s, r) => s + Number(r.deposit_amount), 0);
  const demand = {}; all.filter(live).forEach(r => { const k = r.item.trim().toLowerCase(); (demand[k] = demand[k] || { name: r.item.trim(), n: 0 }).n += Number(r.qty) || 1; });
  const top = Object.values(demand).sort((a, b) => b.n - a.n).slice(0, 6);
  const ready = all.filter(r => live(r) && match.has(r.id) && r.consent_sms);
  $("#view").innerHTML = `<h2>Customer requests</h2>
    <p style="color:var(--mut);margin-top:0">Things customers asked for that we do not have yet. Note them here with the customer's phone; when the item or service becomes available, send an SMS to everyone who asked. Requests also arrive from the website (<b>request.html</b>).</p>
    <div class="cards"><div class="card"><small>Waiting</small><b>${all.filter(live).length}</b></div><div class="card"><small>Can be met now (in stock / on the price list)</small><b>${all.filter(r => live(r) && match.has(r.id)).length}</b></div>
    <div class="card"><small>Deposits held for customers</small><b>KES ${kes(held)}</b></div></div>
    <div class="bar">${E ? `<button class="btn" id="rqn">+ New request</button>` : ""}${E && ready.length ? `<button class="btn ghost" id="rqa">Notify the ${ready.length} that can be met now</button>` : ""}
      <select id="rqf" aria-label="Show"><option value="live">Waiting</option><option value="ready">Can be met now</option><option value="Converted">Became a sale</option><option value="Closed">Closed</option><option value="all">All</option></select>
      <input id="rqq" placeholder="Search name, phone or item" style="max-width:240px"></div>
    ${top.length ? `<p style="margin:6px 0;color:var(--mut)"><small>Most asked for: ${top.map(t => `<b>${esc(t.name)}</b> ×${t.n}`).join(" · ")}</small></p>` : ""}
    <div class="wrap"><table><thead><tr><th>Request</th><th>Date</th><th>Customer</th><th>Asked for</th><th>Available now?</th><th>SMS OK</th><th>Deposit</th><th>Status</th><th></th></tr></thead><tbody id="tb">
    ${rows.map((r, i) => { const m = match.get(r.id) || [];
      return `<tr><td><b>${esc(r.ref)}</b><br><small>${r.source === "web" ? "Website" : "Counter"}</small></td><td>${esc(rqDay(r.created_at))}</td>
      <td>${esc(r.name)}<br><small>${esc(lyShow(r.phone))}</small>${r.known ? `<br><span class="tag ok" title="${esc(r.known_name || "")}">Known customer${r.loyalty_member ? " · loyalty" : ""}</span>` : ""}</td>
      <td>${esc(r.item)} ×${Number(r.qty)}${r.budget != null ? `<br><small>Budget KES ${kes(r.budget)}</small>` : ""}${r.note ? `<br><small>${esc(r.note)}</small>` : ""}</td>
      <td>${m.length ? m.map(x => `<span class="tag ok">${esc(x.name)} · KES ${kes(x.price)}${x.kind === "stock" ? " · " + kes(x.on_hand) + " left" : ""}</span>`).join("<br>") : ""}</td>
      <td>${r.consent_sms ? "Yes" : '<span class="tag bad">No</span>'}</td>
      <td>${r.deposit_status === "None" ? "" : `KES ${kes(r.deposit_amount)}<br><span class="tag ${r.deposit_status === "Held" ? "ok" : r.deposit_status === "Pending" ? "" : "bad"}">${esc(r.deposit_status)}</span>`}</td>
      <td><span class="tag ${r.status === "Open" || r.status === "Notified" ? "" : r.status === "Converted" ? "ok" : "bad"}">${esc(r.status)}</span>${r.notified_count ? `<br><small>SMS ×${r.notified_count} · ${esc(rqDay(r.notified_at))}</small>` : ""}</td>
      <td style="white-space:nowrap">${E ? `${live(r) && r.consent_sms ? `<button class="btn sm" data-no="${i}">Notify</button> ` : ""}<button class="btn sm ghost" data-dp="${i}">Deposit</button> <button class="btn sm ghost" data-ed="${i}">Edit</button> ${live(r) ? `<button class="btn sm ghost" data-fin="${i}">Done</button>` : `<button class="btn sm ghost" data-re="${i}">Reopen</button>`}` : ""}</td></tr>`; }).join("") || `<tr><td colspan="9">No requests here.</td></tr>`}
    </tbody></table></div>`;
  $("#rqf").value = flt; $("#rqf").onchange = e => requestsPage(e.target.value);
  $("#rqq").oninput = e => { const t = e.target.value.toLowerCase().replace(/\s/g, ""); document.querySelectorAll("#tb tr").forEach(tr => tr.hidden = !tr.textContent.toLowerCase().replace(/\s/g, "").includes(t)); };
  if ($("#rqn")) $("#rqn").onclick = () => rqForm(null);
  if ($("#rqa")) $("#rqa").onclick = () => rqNotify(ready, "the " + ready.length + " customers whose request can be met now");
  $("#tb").onclick = e => { const b = e.target.closest("button"); if (!b) return; const r = rows[b.dataset.no ?? b.dataset.dp ?? b.dataset.ed ?? b.dataset.fin ?? b.dataset.re];
    if (b.dataset.no) rqNotify([r], r.name); else if (b.dataset.dp) rqDeposit(r); else if (b.dataset.ed) rqForm(r); else if (b.dataset.fin) rqFinish(r);
    else if (b.dataset.re) rqStatus(r, "Open", ""); };
}

function rqForm(r) {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null;
  f.innerHTML = `<h2>${r ? "Edit " + esc(r.ref) : "New customer request"}</h2><div class="grid">
    <label>Customer name<input name="name" required maxlength="80" value="${esc(r ? r.name : "")}"></label>
    <label>Phone<input name="phone" required inputmode="tel" placeholder="07XX XXX XXX" value="${esc(r ? lyShow(r.phone) : "")}" ${r ? "readonly" : ""}></label>
    <p id="rqm" class="msg full" style="min-height:1.4em;margin:0"></p>
    <label>It is an<select name="kind" ${r ? "disabled" : ""}><option>Item</option><option>Service</option></select></label>
    <label>What the customer wants<input name="what" required maxlength="120" value="${esc(r ? r.item : "")}" placeholder="e.g. HP 305 ink, laptop screen 15.6"></label>
    <label>How many<input name="qty" type="number" min="1" step="any" value="${r ? Number(r.qty) : 1}"></label>
    <label>Customer's budget (KES, optional)<input name="budget" type="number" min="0" step="any" value="${r && r.budget != null ? Number(r.budget) : ""}"></label>
    <label class="full">Note<input name="note" maxlength="400" value="${esc(r ? r.note || "" : "")}"></label>
    <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="consent" style="width:auto" ${r && r.consent_sms ? "checked" : ""}> The customer agrees we may send an SMS when it is available</label></div>
    <p id="lmsg" class="msg"></p><div class="bar"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  if (r) f.elements.kind.value = r.kind;
  const look = async () => { const ph = LY_PHONE(f.elements.phone.value); const box = $("#rqm"); if (!ph) { box.textContent = ""; return; }
    const m = (await db.rpc("customer_match", { p_phone: ph })).data; if (!m || !m.known) { box.style.color = ""; box.textContent = "New customer."; return; }
    const h = Object.entries(m.history || {}).map(([k, n]) => n + " " + k + (n > 1 ? "s" : "")).join(", ");
    box.style.color = "#067647"; box.textContent = "Known customer" + (m.name ? ": " + m.name : "") + (h ? " (" + h + ")" : "") + (m.loyalty_member ? " · " + m.points + " loyalty points" : "") + "."; if (m.name && !f.elements.name.value.trim()) f.elements.name.value = m.name; };
  if (!r) f.elements.phone.onblur = look; else look();
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const q = Number(f.elements.qty.value || 1), b = f.elements.budget.value === "" ? null : Number(f.elements.budget.value);
    const x = r ? await db.rpc("request_edit", { p_id: r.id, p_name: f.elements.name.value, p_item: f.elements.what.value, p_qty: q, p_budget: b, p_note: f.elements.note.value, p_consent: f.elements.consent.checked })
      : await db.rpc("request_add", { p_name: f.elements.name.value, p_phone: f.elements.phone.value, p_kind: f.elements.kind.value, p_item: f.elements.what.value, p_qty: q, p_budget: b, p_note: f.elements.note.value, p_consent: f.elements.consent.checked });
    if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = rqMsg(x.error); return; } $("#dlg").close(); toast(r ? "Saved" : "Saved " + x.data.ref); requestsPage(); };
  $("#dlg").showModal();
}

function rqNotify(list, who) {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null; const n = list.filter(r => r.consent_sms).length;
  f.innerHTML = `<h2>Tell ${esc(who)} it is available</h2><p style="margin-top:0;color:var(--mut)">An SMS goes to ${n} customer${n === 1 ? "" : "s"} who agreed to hear from us. The wording is the "Requested item / service now available" message in SMS settings (you can change it here for this send).</p>
    <label>Message (leave blank for the standard one; {name} and {item} are filled in)<textarea name="msg" rows="3" maxlength="300" placeholder="Hi {name}, the {item} you asked for is now available at Franksomi. Call {phone}."></textarea></label>
    <p id="lmsg" class="msg"></p><div class="bar"><button class="btn" value="save">Send SMS</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const x = await db.rpc("request_notify", { p_ids: list.map(r => r.id), p_message: f.elements.msg.value || null });
    if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = rqMsg(x.error); return; } $("#dlg").close(); toast(x.data.queued + " SMS queued" + (x.data.no_consent ? " · " + x.data.no_consent + " skipped (no consent)" : "")); requestsPage(); };
  $("#dlg").showModal();
}

async function rqStatus(r, st, note) {
  const x = await db.rpc("request_set_status", { p_id: r.id, p_status: st, p_note: note || null });
  if (x.error) { toast(rqMsg(x.error)); return false; } $("#dlg").close && $("#dlg").open && $("#dlg").close(); requestsPage(); return true;
}
function rqFinish(r) {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null;
  f.innerHTML = `<h2>Finish ${esc(r.ref)}</h2><p style="margin-top:0;color:var(--mut)">${esc(r.name)} · ${esc(r.item)}${r.deposit_status === "Held" ? `<br><b>A deposit of KES ${kes(r.deposit_amount)} is held. Apply it to the sale or refund it first (Deposit button).</b>` : ""}</p>
    <label>Note (optional)<input name="note" maxlength="200"></label><p id="lmsg" class="msg"></p>
    <div class="bar"><button class="btn" value="Converted">Customer bought it</button><button class="btn ghost" value="Closed">Close without a sale</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value === "cancel") return; e.preventDefault();
    const x = await db.rpc("request_set_status", { p_id: r.id, p_status: e.submitter.value, p_note: f.elements.note.value }); if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = rqMsg(x.error); return; } $("#dlg").close(); requestsPage(); };
  $("#dlg").showModal();
}

function rqDeposit(r) {
  const f = $("#dlgForm"); f.onsubmit = f.oninput = f.onclick = null; const st = r.deposit_status, inc = can("income.add");
  const info = `<p style="margin-top:0;color:var(--mut)">${esc(r.ref)} · ${esc(r.name)} · ${esc(r.item)}</p>`;
  const done = async x => { if (x.error) { $("#lmsg").className = "msg bad"; $("#lmsg").textContent = rqMsg(x.error); return false; } $("#dlg").close(); requestsPage(); return true; };
  if (st === "None" || st === "Pending") {
    f.innerHTML = `<h2>Deposit</h2>${info}<div class="grid"><label>Deposit to ask for (KES, 0 for none)<input name="amt" type="number" min="0" step="1" value="${Number(r.deposit_amount) || ""}"></label></div>
      ${st === "Pending" ? `<h3 style="margin-bottom:4px">Waiting for KES ${kes(r.deposit_amount)}</h3><div class="grid"><label>Received as<select name="meth"><option>M-Pesa</option><option>Cash</option></select></label><label>M-Pesa code (if M-Pesa)<input name="code" maxlength="12" style="text-transform:uppercase"></label></div>` : ""}
      <p id="lmsg" class="msg"></p><div class="bar"><button class="btn" value="set">Save amount</button>${st === "Pending" ? `<button class="btn" value="prompt" style="background:#12b76a">Send M-Pesa prompt</button><button class="btn ghost" value="rec">Record deposit received</button>` : ""}<button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
    f.onsubmit = async e => { const v = e.submitter.value; if (v === "cancel") return; e.preventDefault();
      if (v === "set") await done(await db.rpc("request_deposit_ask", { p_id: r.id, p_amount: Number(f.elements.amt.value || 0) }));
      else if (v === "rec") await done(await db.rpc("request_deposit_record", { p_id: r.id, p_method: f.elements.meth.value, p_receipt: f.elements.code.value }));
      else if (v === "prompt") { $("#dlg").close(); mpayDialog({ phone: lyShow(r.phone), amount: Number(r.deposit_amount), ref: r.ref, purpose: "Deposit " + r.ref, auto: false }); } };
  } else if (st === "Held") {
    f.innerHTML = `<h2>Deposit held: KES ${kes(r.deposit_amount)}</h2>${info}<p>${esc(r.deposit_method || "")}${r.deposit_receipt ? " · code " + esc(r.deposit_receipt) : ""}. This is the customer's money, not income yet.</p>
      <label>Note (what it was used for, or the refund M-Pesa code / reason)<input name="note" maxlength="200"></label><p id="lmsg" class="msg"></p>
      <div class="bar">${inc ? `<button class="btn" value="apply">Apply to the sale (record as income)</button>` : ""}<button class="btn ghost" value="refund">Refund to the customer</button><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>
      <p style="color:var(--mut)"><small>Applying records the deposit in Income today. Refunding does not touch Income: send the money back from M-Pesa or the till yourself and write the code in the note.</small></p>`;
    f.onsubmit = async e => { const v = e.submitter.value; if (v === "cancel") return; e.preventDefault();
      await done(await db.rpc(v === "apply" ? "request_deposit_apply" : "request_deposit_refund", { p_id: r.id, p_note: f.elements.note.value })); };
  } else {
    f.innerHTML = `<h2>Deposit ${esc(st.toLowerCase())}</h2>${info}<p>KES ${kes(r.deposit_amount)}${r.deposit_note ? " · " + esc(r.deposit_note) : ""}</p><div class="bar"><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`; f.onsubmit = null;
  }
  $("#dlg").showModal();
}
