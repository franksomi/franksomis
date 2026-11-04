"use strict";
// "Pay to our till" box for customers: shown beside the M-Pesa prompt button, for when the prompt does not arrive or fail.
// The customer pays Buy Goods till 643844 from their own M-Pesa menu, then pastes the confirmation message. Staff check it and post it.
(function (root) {
  const TILL = "643844", NAME = "Franksomi Solution Ltd";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const SAY = {
    not_found: "We could not match that to your number. Check the number you signed in with.", locked: "Too many wrong tries. Please wait an hour, or call the shop.",
    bad_message: "That does not look like an M-Pesa confirmation message. Paste the whole message from Safaricom, including the code (for example SGH7K2L9XQ) and the amount.",
    duplicate: "That M-Pesa code has already been sent to us. We will confirm it shortly.", too_many: "Too many messages sent for this payment. Please wait an hour or call the shop."
  };
  function mount(el, o) {
    if (!el || !o || !o.db) return;
    el.innerHTML = `<details class="noprint tillbox" style="margin-top:14px;border:1px solid var(--line,#d0d5dd);border-radius:12px;padding:12px 14px"><summary style="cursor:pointer;font-weight:600">Prompt not working? Pay to our till ${TILL}</summary>
      <ol style="margin:10px 0 0;padding-left:20px;line-height:1.6"><li>On your phone open <b>M-Pesa</b> &gt; <b>Lipa na M-Pesa</b> &gt; <b>Buy Goods and Services</b>.</li><li>Enter till number <b style="font-size:1.15em;letter-spacing:.05em">${TILL}</b> (${esc(NAME)}) and the amount, then your PIN.</li><li>Paste the M-Pesa confirmation message below and press Send.</li></ol>
      <label style="display:block;margin-top:10px;font-weight:600">M-Pesa confirmation message<textarea data-tm rows="3" maxlength="600" style="width:100%;margin-top:6px" placeholder="SGH7K2L9XQ Confirmed. Ksh1,000.00 paid to ${esc(NAME.toUpperCase())}…"></textarea></label>
      <button class="btn" data-ts type="button" style="margin-top:8px">Send for confirmation</button><p class="msg" data-tmsg role="status"></p>
      <small style="color:var(--mut,#667085)">We check each message against our till before it is added to your payments, usually within the working day.</small></details>`;
    const q = s => el.querySelector(s), btn = q("[data-ts]"), msg = q("[data-tmsg]");
    btn.onclick = async () => {
      const text = q("[data-tm]").value.trim(); msg.className = "msg";
      if (text.length < 20) { msg.className = "msg bad"; msg.textContent = "Paste the whole M-Pesa message first."; return; }
      btn.disabled = true; msg.textContent = "Sending…";
      let r; try { r = await o.db.rpc("till_claim", { p_ref: o.ref(), p_phone: o.phone(), p_message: text }); } catch (_) { r = { error: { message: "x" } }; }
      const d = (r && r.data) || {};
      if (r && r.error || !d.ok) { msg.className = "msg bad"; msg.textContent = SAY[d.error] || "Something went wrong. Please try again or call the shop."; btn.disabled = false; return; }
      msg.className = "msg ok"; msg.textContent = "Thank you. We received payment " + d.receipt + " of KES " + Number(d.amount).toLocaleString("en-KE") + " and will confirm it shortly.";
      q("[data-tm]").value = ""; btn.disabled = false; if (o.done) o.done(d);
    };
  }
  root.FKTill = { TILL, mount };
})(typeof window !== "undefined" ? window : globalThis);
