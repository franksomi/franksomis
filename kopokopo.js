/* Franksomi Records – Kopo Kopo part of M-Pesa reconcile (v35). Loaded before app.js. */
async function k2Panel(txns) {
  const mo = sessionStorage.getItem("k2Mo") || iso(new Date()).slice(0, 7), [y, mm] = mo.split("-").map(Number), from = mo + "-01", to = iso(new Date(y, mm, 0));
  const sm = await db.rpc("k2_summary", { p_from: from, p_to: to }), s = sm.data || {};
  const st = (await db.from("k2_settlements").select("*").order("paid_at", { ascending: false }).limit(60)).data || [];
  const seen = new Set(st.length ? ((await db.from("mpesa_txns").select("receipt_no").in("receipt_no", st.map(x => x.receipt_no))).data || []).map(x => x.receipt_no) : []);
  const held = Number(s.held || 0), net = Number(s.collected || 0) - Number(s.fees || 0), unm = txns.filter(t => !t.matched_table && String(t.txn_time || "").slice(0, 7) === mo).length;
  const ch = (s.by_channel || []).map(c => `<tr><td>${esc(c.channel)}</td><td class="n">${c.n}</td><td class="n">${kes(c.amount)}</td><td class="n">${kes(c.fees)}</td></tr>`).join("");
  const html = `<p style="color:var(--mut)">Customers who pay your Kopo Kopo till or the online prompt reach Kopo Kopo first. It keeps a small fee and pays you out to your M-Pesa in batches. Import its two reports here: the <b>Transactions report</b> (every payment, with its fee) and the <b>Payments report</b> (what it paid out to you). Each payment is matched to what you recorded, by its M-Pesa code, and the payouts are matched to your own M-Pesa statement.</p>
    <div class="bar"><label>Month <input type="month" id="k2mo" value="${esc(mo)}"></label><input type="file" id="k2file" accept=".csv,text/csv" multiple><span>${txns.length} Kopo Kopo payments stored · ${unm} not yet matched this month</span></div>
    <div class="cards" id="k2cards"><div class="card"><small>Collected (${s.payments || 0} payments)</small><b>KES ${kes(s.collected || 0)}</b></div><div class="card"><small>Kopo Kopo fees</small><b>KES ${kes(s.fees || 0)}</b></div>
    <div class="card"><small>Net after fees</small><b>KES ${kes(net)}</b></div><div class="card"><small>Paid out to your M-Pesa (${s.settlements || 0})</small><b>KES ${kes(s.settled || 0)}</b></div>
    <div class="card"><small>Still held at Kopo Kopo (all time)</small><b ${held < -0.5 ? 'style="color:#b42318"' : ""}>KES ${kes(held)}</b></div></div>
    ${held < -0.5 ? `<p class="msg bad">Kopo Kopo has paid you out more than the payments you imported. Import the earlier Transactions reports, or type what Kopo Kopo was holding before your first report (Kopo Kopo dashboard balance on that day):</p>` : `<p style="color:var(--mut)">Held = opening balance + all imported collections − fees − payouts. If it does not match your Kopo Kopo dashboard, set the opening balance:</p>`}
    <div class="bar"><label>Opening balance (KES)<input type="number" id="k2open" step="0.01" value="${Number(s.opening || 0)}" style="width:130px"></label><button class="btn sm ghost" id="k2os">Save</button>
      <button class="btn sm" id="k2fees" ${Number(s.fees || 0) > 0 ? "" : "disabled"}>Record ${esc(mo)} fees as an expense (KES ${kes(s.fees || 0)})</button></div>
    ${ch ? `<h3>By channel</h3><div class="wrap"><table><thead><tr><th>Channel</th><th class="n">Payments</th><th class="n">Amount</th><th class="n">Fees</th></tr></thead><tbody>${ch}</tbody></table></div>` : ""}
    <h3>Payouts to your M-Pesa <span class="tag">${st.length}</span></h3>${st.length ? `<div class="wrap"><table><thead><tr><th>Paid</th><th>M-Pesa code</th><th class="n">Amount</th><th>To</th><th>On your statement</th></tr></thead><tbody>${st.map(x => `<tr><td>${esc(String(x.paid_at).slice(0, 16).replace("T", " "))}</td><td>${esc(x.receipt_no)}</td><td class="n">${kes(x.amount)}</td><td>${esc(x.destination || "")}</td><td>${seen.has(x.receipt_no) ? '<span class="tag ok">Yes</span>' : '<span class="tag">Not imported yet</span>'}</td></tr>`).join("")}</tbody></table></div>` : "<p>No payouts imported yet.</p>"}`;
  const bind = () => {
    $("#k2mo").onchange = e => { sessionStorage.setItem("k2Mo", e.target.value || mo); route(); };
    $("#k2os").onclick = async () => { const x = await db.rpc("loyalty_settings_set", { p: { k2_opening: String($("#k2open").value || 0) } }); if (x.error) return toast(x.error.message); toast("Opening balance saved"); route(); };
    $("#k2fees").onclick = async () => { const x = await db.rpc("k2_post_fees", { p_month: from }); if (x.error) return toast(x.error.message); toast(`Fees for ${x.data.month}: KES ${kes(x.data.amount)} recorded under Expenses (Payment fees)`); route(); };
    $("#k2file").onchange = async e => {
      const pay = [], set = []; let bad = 0;
      for (const f of e.target.files) { try { const r = Mpesa.parseK2(await f.text()); (r.kind === "payments" ? pay : set).push(...r.rows); } catch (err) { bad++; toast(f.name + ": " + err.message); } }
      if (!pay.length && !set.length) { if (!bad) toast("No completed payments found in that file."); return; }
      const x = await db.rpc("k2_import", { p_pay: pay, p_set: set }); if (x.error) return toast(x.error.message); const d = x.data;
      toast(`Imported: ${d.payments_new} new payments, ${d.payments_updated} updated, ${d.settlements_new} new payouts` + (d.wallet_lines_linked ? `, ${d.wallet_lines_linked} payout lines on your M-Pesa statement recognised` : "")); route(); };
  };
  return { html, bind };
}
