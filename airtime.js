/* Franksomi Records – airtime sales through Instalipa (v37). Loaded before app.js. */
const AT_TAG = { Success: "ok", Failed: "bad", Cancelled: "", Submitted: "", Sending: "", "Awaiting payment": "" };
const atShow = p => p ? "0" + p.slice(3, 6) + " " + p.slice(6, 9) + " " + p.slice(9) : "";
const atErr = async res => { let m = "Something went wrong."; try { const j = res.error && res.error.context ? await res.error.context.json() : res.data; if (j && j.message) m = j.message; } catch (_) {} return m; };
const atWait = () => new Promise(r => setTimeout(r, window.__POLL_MS__ || 3000));

async function airtimePage() {
  const rows = ((await db.from("airtime_v").select("*").order("id", { ascending: false }).limit(200)).data) || [];
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const day = rows.filter(r => r.status === "Success" && String(r.finished_at || r.created_at).slice(0, 10) === today);
  const fl = rows.find(r => r.float_after !== null && r.float_after !== undefined), owed = rows.filter(r => r.status === "Failed" && r.refund_due);
  const pend = rows.filter(r => r.status === "Awaiting payment" || r.status === "Sending" || r.status === "Submitted");
  const mg = can("airtime.manage"), prof = day.reduce((s, r) => s + Number(r.profit || 0), 0);
  $("#view").innerHTML = `<h2>Airtime</h2>
    <p style="color:var(--mut);margin-top:0">Sell airtime for Safaricom, Airtel, Telkom, JTL and Equitel. The customer pays first (M-Pesa prompt or cash), then the airtime is sent from your Instalipa float. A sale is only ever sent once.</p>
    <div class="cards"><div class="card"><small>Sold today</small><b>KES ${kes(day.reduce((s, r) => s + r.amount, 0))}</b></div>
    ${can("costs.view") ? `<div class="card"><small>Earned today</small><b>KES ${kes(prof)}</b></div>` : ""}
    <div class="card"><small>Float left after last sale</small><b>${fl ? "KES " + kes(fl.float_after) : "—"}</b></div>
    <div class="card"><small>Refunds to give</small><b ${owed.length ? 'style="color:#b42318"' : ""}>${owed.length}</b></div></div>
    <div class="card" style="margin:12px 0"><form id="atf" class="grid">
      <label>Airtime for (phone)<input name="phone" required inputmode="tel" placeholder="07XX XXX XXX"></label>
      <label>Amount (KES)<input name="amount" type="number" min="5" max="10000" step="1" required></label>
      <label>Customer name (optional)<input name="name" maxlength="80"></label>
      <label>Customer pays by<select name="method"><option>M-Pesa</option><option>Cash</option></select></label>
      <label class="payer">M-Pesa prompt goes to (leave empty = same number)<input name="payer" inputmode="tel" placeholder="07XX XXX XXX"></label>
      <div class="full bar" style="gap:6px;flex-wrap:wrap">${[20, 50, 100, 200, 500, 1000].map(n => `<button type="button" class="btn sm ghost" data-amt="${n}">${n}</button>`).join("")}</div>
      <div class="full bar"><button class="btn" id="atgo" style="background:#12b76a">Sell airtime</button></div>
      <p id="atmsg" class="msg full" style="min-height:1.4em;margin:0"></p></form></div>
    <details class="card" style="margin:12px 0" id="atbulk"><summary style="cursor:pointer"><b>Bulk top-up</b> <small style="color:var(--mut)">many numbers, one payment</small></summary>
      <p style="color:var(--mut)">One line per number: <code>phone, amount, name (optional)</code>. Copy them from a spreadsheet, or load a CSV file. Lines with only a phone use the default amount. Up to 200 numbers, KES 5 to 10,000 each.</p>
      <form id="atbf" class="grid">
        <label class="full">Numbers<textarea name="list" rows="7" placeholder="0711 952 924, 100, Wanjiru&#10;0733 111 222, 50&#10;0722 000 111" style="width:100%;font-family:monospace"></textarea></label>
        <label>Default amount (KES)<input name="def" type="number" min="5" max="10000" step="1" placeholder="optional"></label>
        <label>Load a CSV file<input name="file" type="file" accept=".csv,.txt,text/csv,text/plain"></label>
        <label>Customer / group name (optional)<input name="name" maxlength="80" placeholder="e.g. Church youth"></label>
        <label>Customer pays by<select name="method"><option>M-Pesa</option><option>Cash</option></select></label>
        <label class="payer">M-Pesa prompt goes to<input name="payer" inputmode="tel" placeholder="07XX XXX XXX"></label>
        <div class="full bar"><button type="button" class="btn ghost" id="atbcheck">Check the list</button><button class="btn" id="atbgo" style="background:#12b76a" disabled>Pay and send all</button></div>
        <div id="atbprev" class="full"></div><p id="atbmsg" class="msg full" style="min-height:1.4em;margin:0"></p></form></details>
    ${pend.length ? `<p style="color:var(--mut)">${pend.length} sale${pend.length === 1 ? " is" : "s are"} not finished yet (see the list).</p>` : ""}
    <div class="wrap"><table><thead><tr><th>Ref</th><th>When</th><th>Phone</th><th class="n">Amount</th><th>Paid by</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody id="atb">
    ${rows.map((r, i) => `<tr><td>${esc(r.ref)}${r.batch_ref ? "<br><small>" + esc(r.batch_ref) + (r.source === "web" ? " web" : "") + "</small>" : ""}</td><td>${esc(String(r.created_at || "").replace("T", " ").slice(5, 16))}</td><td>${esc(atShow(r.phone))}${r.customer_name ? "<br><small>" + esc(r.customer_name) + "</small>" : ""}</td><td class="n">${kes(r.amount)}</td><td>${esc(r.pay_method)}</td>
      <td><span class="tag ${AT_TAG[r.status] || ""}">${esc(r.status)}</span></td><td><small>${esc(r.status === "Failed" ? (r.refund_due ? "Give the customer their money back. " : r.refunded_at ? "Refunded. " : "") + (r.details || "") : r.receipt || r.details || "")}</small></td>
      <td style="white-space:nowrap">${r.status === "Awaiting payment" ? `<button class="btn sm" data-send="${i}">Send</button> <button class="btn sm ghost" data-cancel="${i}">Cancel</button>` : ""}
      ${r.status === "Sending" || r.status === "Submitted" ? `<button class="btn sm ghost" data-check="${i}">Check</button>${r.status === "Sending" ? ` <button class="btn sm" data-send="${i}">Try again</button>` : ""}` : ""}
      ${r.status === "Failed" && r.refund_due && mg ? `<button class="btn sm" data-send="${i}">Retry</button> <button class="btn sm ghost" data-refund="${i}">Mark refunded</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="8">No airtime sold yet.</td></tr>`}</tbody></table></div>`;
  const f = $("#atf"), msg = $("#atmsg"), say = (t, bad) => { msg.style.color = bad ? "#b42318" : ""; msg.textContent = t; };
  const syncPay = () => { f.querySelector(".payer").style.display = f.elements.method.value === "M-Pesa" ? "" : "none"; }; f.elements.method.onchange = syncPay; syncPay();
  f.onclick = e => { const b = e.target.closest("[data-amt]"); if (b) f.elements.amount.value = b.dataset.amt; };
  // send one sale to Instalipa and tell the person what happened
  const sendIt = async (id, out) => {
    const r = await db.functions.invoke("airtime-send", { body: { action: "send", id } });
    if (r.error || !r.data || !r.data.ok) { const m = await atErr(r); out(m, true); return r.data && r.data.status; }
    out(r.data.message || "Sent.", false); return r.data.status;
  };
  f.onsubmit = async e => {
    e.preventDefault(); if (f.dataset.busy) return; f.dataset.busy = "1"; $("#atgo").disabled = true;
    const done = () => { delete f.dataset.busy; $("#atgo").disabled = false; };
    const c = await db.rpc("airtime_create", { p_phone: f.elements.phone.value, p_amount: Number(f.elements.amount.value), p_name: f.elements.name.value, p_method: f.elements.method.value });
    if (c.error) { say(c.error.message, true); return done(); }
    const s = c.data;
    if (s.pay_method === "M-Pesa") {
      say("Sending the M-Pesa prompt…");
      let provider; try { const p = await db.functions.invoke("stk-push", { body: { action: "providers" } }); provider = p.data && p.data.default; } catch (_) {}
      const body = { phone: f.elements.payer.value.trim() || f.elements.phone.value, amount: s.amount, ref: s.ref, purpose: "Airtime", auto_record: false, customer_name: f.elements.name.value }; if (provider) body.provider = provider;
      const res = await db.functions.invoke("stk-push", { body });
      if (res.error || !res.data || !res.data.ok) { say(await invokeErr(res), true); await db.rpc("airtime_cancel", { p_id: s.id }); return done(); }
      say("Prompt sent. Ask the customer to check their phone and enter their PIN…"); const pid = res.data.public_id; let paid = false;
      for (let i = 0; i < 40 && f.isConnected; i++) {
        await atWait(); if (i === 14) await db.functions.invoke("stk-push", { body: { action: "check", public_id: pid } });
        const q = await db.from("mpesa_requests").select("status,result_desc").eq("public_id", pid).single(), r = q.data; if (!r) continue;
        if (r.status === "Success") { paid = true; break; }
        if (r.status === "Cancelled" || r.status === "Failed") { say((r.result_desc || "The payment did not go through.") + " Nothing was sent.", true); await db.rpc("airtime_cancel", { p_id: s.id }); return airtimePage(); }
        if (r.status === "Review") { say("Money received but the amount differs. Check your M-Pesa statement. Nothing was sent.", true); return done(); }
      }
      if (!paid) { say("No payment yet. When the customer has paid, press Send beside " + s.ref + " in the list below. Nothing was sent.", true); return done(); }
    }
    say("Paid ✓ Sending the airtime…"); const st = await sendIt(s.id, say);
    if (st === "Success") toast("Airtime sent ✓ " + s.ref);
    await airtimePage(); if (st) { const m = $("#atmsg"); if (m) m.textContent = ""; }
  };
  // ---- bulk: check the list, take ONE payment for the total, then send every number once ----
  const bf = $("#atbf"), bmsg = $("#atbmsg"), bsay = (t, bad) => { bmsg.style.color = bad ? "#b42318" : ""; bmsg.textContent = t; };
  const syncB = () => { bf.querySelector(".payer").style.display = bf.elements.method.value === "M-Pesa" ? "" : "none"; }; bf.elements.method.onchange = syncB; syncB();
  const parseList = () => {
    const def = Number(bf.elements.def.value) || 0, out = [], bad = [], seen = new Set();
    bf.elements.list.value.split(/\r?\n/).forEach((ln, i) => {
      ln = ln.trim(); if (!ln || /^(phone|number|mobile)\b/i.test(ln)) return;
      const p = ln.split(/[,;\t]/).map(x => x.trim()); let amt = p[1] === undefined || p[1] === "" ? def : Number(p[1].replace(/[^\d.]/g, ""));
      const ph = String(p[0] || "").replace(/[\s\-()]/g, ""), ok = /^(\+?254|0)[17]\d{8}$/.test(ph);
      if (!ok) return bad.push("Line " + (i + 1) + ": “" + p[0] + "” is not a valid Kenyan mobile number");
      if (!Number.isInteger(amt) || amt < 5 || amt > 10000) return bad.push("Line " + (i + 1) + " (" + p[0] + "): amount must be a whole number from 5 to 10,000");
      const k = ph.replace(/^(\+?254|0)/, "") + ":" + amt; if (seen.has(k)) return bad.push("Line " + (i + 1) + ": " + p[0] + " for " + amt + " is listed twice");
      seen.add(k); out.push({ phone: ph, amount: amt, name: p[2] || "" });
    });
    return { out, bad };
  };
  bf.elements.file.onchange = async () => { const f0 = bf.elements.file.files[0]; if (f0) { bf.elements.list.value = await f0.text(); $("#atbgo").disabled = true; bsay("File loaded. Press Check the list."); } };
  bf.elements.list.oninput = bf.elements.def.oninput = () => { $("#atbgo").disabled = true; };
  $("#atbcheck").onclick = () => {
    const { out, bad } = parseList(), tot = out.reduce((s, x) => s + x.amount, 0);
    if (out.length > 200) bad.push("Too many numbers: the limit is 200 at a time");
    $("#atbprev").innerHTML = (bad.length ? `<p style="color:#b42318">${bad.slice(0, 8).map(esc).join("<br>")}${bad.length > 8 ? "<br>…and " + (bad.length - 8) + " more" : ""}</p>` : "") +
      (out.length ? `<p><b>${out.length}</b> number${out.length === 1 ? "" : "s"}, total <b>KES ${kes(tot)}</b></p><div style="max-height:180px;overflow:auto"><table><tbody>${out.slice(0, 200).map(x => `<tr><td>${esc(atShow("254" + x.phone.replace(/^(\+?254|0)/, "")))}</td><td class="n">${kes(x.amount)}</td><td>${esc(x.name)}</td></tr>`).join("")}</tbody></table></div>` : "");
    $("#atbgo").disabled = bad.length > 0 || out.length === 0 || out.length > 200; bsay(bad.length ? "Fix the lines above, then check again." : out.length ? "Looks good. Pay and send all will take one payment of KES " + kes(tot) + "." : "Add some numbers first.", bad.length > 0);
  };
  bf.onsubmit = async e => {
    e.preventDefault(); if (bf.dataset.busy) return; const { out, bad } = parseList(); if (bad.length || !out.length) return; bf.dataset.busy = "1"; $("#atbgo").disabled = true;
    const tot = out.reduce((s, x) => s + x.amount, 0), method = bf.elements.method.value;
    const c = await db.rpc("airtime_batch_create", { p_items: out, p_name: bf.elements.name.value, p_method: method, p_payer: bf.elements.payer.value });
    if (c.error) { bsay(c.error.message, true); delete bf.dataset.busy; return; }
    const b = c.data; let paid = method === "Cash";
    if (!paid) {
      bsay("Sending the M-Pesa prompt for KES " + kes(tot) + "…");
      let provider; try { const p = await db.functions.invoke("stk-push", { body: { action: "providers" } }); provider = p.data && p.data.default; } catch (_) {}
      const body = { phone: b.payer, amount: b.total, ref: b.ref, purpose: "Airtime bulk", auto_record: false, customer_name: bf.elements.name.value }; if (provider) body.provider = provider;
      const res = await db.functions.invoke("stk-push", { body });
      if (res.error || !res.data || !res.data.ok) { bsay(await invokeErr(res), true); await db.rpc("airtime_batch_cancel", { p_batch: b.id }); return airtimePage(); }
      bsay("Prompt sent. Ask the customer to enter their PIN…"); const pid = res.data.public_id;
      for (let i = 0; i < 40 && bf.isConnected; i++) {
        await atWait(); if (i === 14) await db.functions.invoke("stk-push", { body: { action: "check", public_id: pid } });
        const q = await db.from("mpesa_requests").select("status,result_desc").eq("public_id", pid).single(), r = q.data; if (!r) continue;
        if (r.status === "Success") { paid = true; break; }
        if (r.status === "Cancelled" || r.status === "Failed") { bsay((r.result_desc || "The payment did not go through.") + " Nothing was sent.", true); await db.rpc("airtime_batch_cancel", { p_batch: b.id }); return airtimePage(); }
        if (r.status === "Review") { bsay("Money received but the amount differs. Check your M-Pesa statement. Nothing was sent.", true); return airtimePage(); }
      }
      if (!paid) { bsay("No payment yet. When the customer has paid, press Send beside the numbers of " + b.ref + " below. Nothing was sent.", true); delete bf.dataset.busy; return airtimePage(); }
    }
    let waiting = out.length, err = "";
    for (let i = 0; i < 40 && waiting > 0 && bf.isConnected; i++) {
      bsay("Paid ✓ Sending airtime… " + (out.length - waiting) + " of " + out.length + " done");
      const r = await db.functions.invoke("airtime-send", { body: { action: "batch_send", batch: b.id } });
      if (r.error || !r.data || r.data.ok === false) { err = await atErr(r); break; }
      if (r.data.message) { err = r.data.message; break; }
      waiting = r.data.waiting;
    }
    toast(err ? "Bulk airtime stopped: " + err : "Bulk airtime sent ✓ " + b.ref); await airtimePage(); const m = $("#atmsg"); if (m && err) { m.style.color = "#b42318"; m.textContent = err + " Use Try again beside the numbers still waiting."; }
  };
  $("#atb").onclick = async e => {
    const b = e.target.closest("button"); if (!b) return; const r = rows[b.dataset.send ?? b.dataset.check ?? b.dataset.cancel ?? b.dataset.refund]; b.disabled = true;
    if (b.dataset.send !== undefined) { const st = await sendIt(r.id, (m, bad) => toast(m)); return airtimePage(); }
    if (b.dataset.check !== undefined) { const x = await db.functions.invoke("airtime-send", { body: { action: "check", id: r.id } }); toast(x.data && x.data.status ? "Status: " + x.data.status : await atErr(x)); return airtimePage(); }
    if (b.dataset.cancel !== undefined) { const x = await db.rpc("airtime_cancel", { p_id: r.id }); if (x.error) toast(x.error.message); return airtimePage(); }
    if (b.dataset.refund !== undefined) { const note = prompt("Note (for example: sent back by M-Pesa, code ABC123)", "") ; if (note === null) { b.disabled = false; return; } const x = await db.rpc("airtime_mark_refunded", { p_id: r.id, p_note: note }); if (x.error) toast(x.error.message); return airtimePage(); }
  };
}
