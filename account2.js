/* Franksomi Records – My account page, part 2 (v33): quotations, invoice payment status, orders and quotation requests. Loaded by account.html. */
(function () {
  var E = WEB.esc, K = WEB.kes, $ = function (s) { return document.querySelector(s); };
  var n2 = function (v) { return Number(v || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var S = { D: null, cur: null, H: null, cart: {}, prods: null, zones: null, q: "" };
  var tag = function (t, kind) { return '<span class="tag" style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:.78rem;font-weight:700;background:' + ({ ok: "#d1fadf", warn: "#fef0c7", bad: "#fee4e2", off: "#eaecf0" }[kind] || "#eaecf0") + ';color:' + ({ ok: "#05603a", warn: "#93370d", bad: "#912018", off: "#344054" }[kind] || "#344054") + '">' + E(t) + "</span>"; };
  var payTag = function (s) { return s === "Paid" ? tag("Paid", "ok") : s === "Part paid" ? tag("Part paid", "warn") : s === "Unpaid" ? tag("Unpaid", "bad") : tag("Not tracked", "off"); };
  var qTag = function (s) { return s === "Accepted" ? tag("Accepted", "ok") : s === "Open" ? tag("Open", "warn") : s === "Expired" ? tag("Expired", "bad") : tag(s || "Open", "off"); };
  var stTag = function (s) { return /Cancel/.test(s) ? tag(s, "bad") : /Deliver|Collect/.test(s) ? tag(s, "ok") : tag(s, "warn"); };
  var table = function (head, rows, empty) { return '<div style="overflow:auto"><table><thead><tr>' + head.map(function (h) { return "<th" + (h[1] ? ' style="text-align:right"' : "") + ">" + E(h[0]) + "</th>"; }).join("") + "</tr></thead><tbody>" + (rows.length ? rows.join("") : '<tr><td colspan="' + head.length + '" style="color:var(--mut)">' + E(empty) + "</td></tr>") + "</tbody></table></div>"; };
  var msg = function (el, t, k) { el.className = "msg" + (k ? " " + k : ""); el.textContent = t; };
  var ERR = { locked: "Too many wrong tries. Please wait an hour, or call the shop.", not_found: "We could not confirm your account. Please sign in again.", inactive: "Your account is switched off. Please call the shop.", phone: "We need a valid phone number on your account. Please call the shop.",
    too_many: "Too many requests just now. Please try again in a while, or call the shop.", subject: "Please write a short subject (at least 3 letters).", details: "Please describe what you need.", no_quote: "That quotation could not be found.", stock: "There is not enough stock of one item. Reduce the quantity.", gone: "One of the items is no longer available.", zone: "Choose a delivery area.", address: "Enter the delivery address.", no_items: "Add at least one item.", bad_qty: "Check the quantities (1 to 20 each)." };
  var why = function (r) { return r && ERR[r.error] ? ERR[r.error] : "Something went wrong. Please try again, or call the shop on " + WEB.W.phone + "."; };

  function qHtml(d) {
    var it = d.items || [], sub = it.reduce(function (a, i) { return a + Number(i.qty || 0) * Number(i.price || 0); }, 0);
    var rows = it.map(function (i) { return "<tr><td>" + E(i.desc) + "</td><td>" + E(i.qty) + "</td><td>" + n2(i.price) + "</td><td>" + n2(Number(i.qty) * Number(i.price)) + "</td></tr>"; }).join("");
    var info = [["Customer", d.customer], ["Customer KRA PIN", d.customer_pin], ["Address / site", d.address], ["Reference", d.reference], ["Date", d.doc_date], ["Valid until", d.valid_until]].filter(function (x) { return x[1]; }).map(function (x) { return '<tr><th style="width:30%">' + E(x[0]) + "</th><td>" + E(x[1]) + "</td></tr>"; }).join("");
    var tot = it.length ? '<tr><td colspan="3" align="right">Subtotal</td><td>' + n2(sub) + "</td></tr>" + (Number(d.discount) > 0 ? '<tr><td colspan="3" align="right">Discount</td><td>' + n2(d.discount) + "</td></tr>" : "") + (Number(d.vat_rate) > 0 ? '<tr><td colspan="3" align="right">VAT (' + E(d.vat_rate) + "%)</td><td>" + n2((sub - Number(d.discount || 0)) * Number(d.vat_rate) / 100) + "</td></tr>" : "") : "";
    return S.H.shell("QUOTATION", d.doc_no, "<table>" + info + '</table><table style="margin-top:10px"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount (KES)</th></tr></thead><tbody>' + rows + tot + '<tr><th colspan="3" align="right">TOTAL (KES)</th><th>' + n2(d.total) + "</th></tr></tbody></table><p>This is a quotation, not an invoice. To accept it, use My account at " + E(WEB.W.web) + " or call " + E(WEB.W.phone) + ".</p>");
  }

  function quotes() {
    var q = S.D.quotes || [];
    return '<h3 id="s-quotes" style="margin-top:34px">Quotations</h3>' + table([["Number"], ["Date"], ["Valid until"], ["Status"], ["Total (KES)", 1], [""]], q.map(function (x, i) {
      return '<tr><td><b>' + E(x.doc_no) + "</b></td><td>" + E(x.doc_date || "") + "</td><td>" + E(x.valid_until || "") + "</td><td>" + qTag(x.state) + '</td><td align="right">' + n2(x.total) + '</td><td style="white-space:nowrap"><button class="btn sm line" style="color:var(--txt)" data-qp="' + i + '" type="button">Print / PDF</button> ' + (x.state === "Open" ? '<button class="btn sm" data-qa="' + i + '" type="button">Accept</button>' : "") + "</td></tr>";
    }), "No quotations yet. Ask for one below.") + '<div id="qaBox"></div>';
  }
  function invoiceSummary() {
    var inv = (S.D.invoices || []).filter(function (x) { return x.doc_type === "Invoice" && x.pay_status && x.pay_status !== "Not tracked"; }), open = inv.filter(function (x) { return x.pay_status !== "Paid"; }), owed = open.reduce(function (a, x) { return a + Number(x.balance || 0); }, 0);
    if (!inv.length) return "";
    return '<p style="margin:0 0 10px">' + (open.length ? "<b>" + open.length + " invoice(s) not paid in full</b>, KES " + n2(owed) + " still to pay on them." : "<b>All your invoices are paid.</b> Thank you!") +
      (Number(S.D.applied) > 0 ? ' <small style="color:var(--mut)">Payments received on your account are applied to your oldest invoices first.</small>' : "") + "</p>";
  }
  function orders() {
    var o = S.D.orders || [];
    return '<h3 id="s-orders" style="margin-top:34px">Order from us</h3><div class="card" id="ordBox"></div><h3 style="margin-top:26px">Your orders</h3>' + table([["Order"], ["Placed"], ["Items"], ["Status"], ["Total (KES)", 1]], o.map(function (x) {
      return "<tr><td><b>" + E(x.order_no) + "</b>" + (x.lpo_no ? "<br><small>LPO " + E(x.lpo_no) + "</small>" : "") + "</td><td>" + E(String(x.placed || "").replace("T", " ").slice(0, 10)) + "</td><td><small>" + E((x.items || []).map(function (i) { return i.name + " × " + Number(i.qty); }).join(", ")) + "</small></td><td>" + stTag(x.status) + (x.note ? "<br><small>" + E(x.note) + "</small>" : "") + '</td><td align="right">' + n2(x.total) + "</td></tr>";
    }), "No orders yet.") + '<p style="color:var(--mut);font-size:.9rem">Orders are charged to your account when delivered or collected.</p>';
  }
  function requests() {
    var r = S.D.requests || [];
    return '<h3 id="s-req" style="margin-top:34px">Ask for a quotation</h3><div class="card"><form id="rqF" autocomplete="off"><label>What do you need quoted?<input name="subject" maxlength="100" placeholder="e.g. 12 CCTV cameras for the new wing" required></label>' +
      '<label>Details<textarea name="details" maxlength="1500" placeholder="Quantities, location, deadline, anything we should know" required></textarea></label><label>Your LPO / reference (optional)<input name="lpo" maxlength="60"></label>' +
      '<button class="btn" type="submit">Send request</button><p class="msg" id="rqM" role="status"></p></form></div>' +
      '<h4 style="margin:22px 0 8px">Your requests</h4>' + table([["Sent"], ["About"], ["Status"]], r.map(function (x) { return "<tr><td>" + E(String(x.at || "").replace("T", " ").slice(0, 10)) + "</td><td>" + E(x.topic || "") + "</td><td>" + tag(x.status || "New", x.status === "Closed" || x.status === "Won" ? "ok" : "warn") + "</td></tr>"; }), "Nothing sent yet.");
  }
  function orderForm() {
    var box = $("#ordBox"); if (!box) return;
    box.innerHTML = '<p style="margin-top:0">Choose what you need. Prices are today\'s shop prices. We confirm every order before it is sent, and it is charged to your account.</p><input id="oq" placeholder="Search products…" aria-label="Search products" style="margin-bottom:10px"><div id="oList" style="max-height:340px;overflow:auto;border:1px solid var(--line);border-radius:12px"></div>' +
      '<div id="oSum" style="margin:12px 0"></div><div class="grid2" style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"><label>Collect or deliver<select id="oFul"><option value="pickup">Pick up at the shop</option><option value="delivery">Deliver to us</option></select></label>' +
      '<label id="oZl" hidden>Delivery area<select id="oZone"></select></label></div><label id="oAl" hidden>Delivery address<input id="oAddr" maxlength="300"></label><label>Your LPO / reference (optional)<input id="oLpo" maxlength="60"></label><label>Notes (optional)<input id="oNote" maxlength="300"></label>' +
      '<button class="btn" id="oGo" type="button">Place order</button><p class="msg" id="oMsg" role="status"></p>';
    Promise.all([WEB.products(), S.zones || WEB.db.rpc("shop_zones")]).then(function (a) {
      S.prods = (a[0].list || []).filter(function (p) { return p.available > 0; }); S.zones = a[1]; var z = (a[1].data || a[1] || []);
      var dz = z.filter(function (x) { return x.kind === "delivery"; }); $("#oZone").innerHTML = dz.map(function (x) { return '<option value="' + x.id + '">' + E(x.name) + " (KES " + n2(x.fee) + ")</option>"; }).join("");
      if (!dz.length) $("#oFul").querySelector('option[value="delivery"]').remove();
      drawList();
    });
    $("#oq").oninput = function () { S.q = this.value.toLowerCase(); drawList(); };
    $("#oFul").onchange = function () { var d = this.value === "delivery"; $("#oZl").hidden = !d; $("#oAl").hidden = !d; };
    $("#oList").oninput = function (e) { var i = e.target.closest("input[data-id]"); if (!i) return; var id = i.dataset.id, max = Math.min(20, Number(i.max) || 20), n = Math.floor(Number(i.value) || 0); n = Math.max(0, Math.min(max, n)); if (n) S.cart[id] = n; else delete S.cart[id]; drawSum(); };
    $("#oGo").onclick = placeOrder;
  }
  function drawList() {
    var el = $("#oList"); if (!el) return; var q = S.q, list = (S.prods || []).filter(function (p) { return !q || (p.title + " " + (p.category || "")).toLowerCase().indexOf(q) >= 0; }).slice(0, 60);
    el.innerHTML = list.length ? list.map(function (p) { return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--line)"><div style="flex:1"><b>' + E(p.title) + "</b><br><small style=\"color:var(--mut)\">" + E(p.category || "") + " · " + (p.available <= 5 ? "only " + p.available + " left" : "in stock") + '</small></div><div style="white-space:nowrap"><b>KES ' + n2(p.price) + '</b></div><input data-id="' + p.id + '" type="number" min="0" max="' + Math.min(20, p.available) + '" step="1" value="' + (S.cart[p.id] || "") + '" placeholder="0" aria-label="Quantity of ' + E(p.title) + '" style="width:78px"></div>'; }).join("") : '<p style="padding:12px;margin:0;color:var(--mut)">' + (S.prods ? "No products match." : "Loading products…") + "</p>";
    drawSum();
  }
  function drawSum() {
    var el = $("#oSum"); if (!el) return; var rows = Object.keys(S.cart).map(function (id) { var p = (S.prods || []).find(function (x) { return String(x.id) === id; }); return p ? { p: p, n: S.cart[id] } : null; }).filter(Boolean), t = rows.reduce(function (a, r) { return a + r.n * r.p.price; }, 0);
    el.innerHTML = rows.length ? "<b>Your order:</b> " + rows.map(function (r) { return E(r.p.title) + " × " + r.n; }).join(", ") + ". <b>Items total KES " + n2(t) + "</b> (delivery fee, if any, is added when you place it)." : '<span style="color:var(--mut)">Nothing chosen yet.</span>';
  }
  function placeOrder() {
    var m = $("#oMsg"), items = Object.keys(S.cart).map(function (id) { return { id: Number(id), qty: S.cart[id] }; });
    if (!items.length) return msg(m, ERR.no_items, "bad");
    var ful = $("#oFul").value, p = { items: items, fulfil: ful, zone_id: ful === "delivery" ? Number($("#oZone").value) : null, address: $("#oAddr").value.trim(), notes: $("#oNote").value.trim(), lpo_no: $("#oLpo").value.trim() };
    var b = $("#oGo"); b.disabled = true; msg(m, "Placing your order…");
    WEB.db.rpc("acct_order", { p_acc: S.cur.acc, p_phone: S.cur.phone, p: p }).then(function (r) {
      b.disabled = false; var d = r.data || {};
      if (r.error || !d.ok) return msg(m, why(d), "bad");
      S.cart = {}; msg(m, "Order " + d.order_no + " received (KES " + n2(d.total) + "). " + (d.over_limit ? "It is above your credit limit, so we will call you to confirm before sending." : "We will confirm it shortly."), "ok");
      setTimeout(function () { S.H.reload(); }, 1800);
    });
  }
  function wire() {
    var root = $("#acct");
    root.onclick = function (e) {
      var p = e.target.closest("button[data-qp]"); if (p) { var d = S.D.quotes[p.dataset.qp]; S.H.openPrint(qHtml(d), d.doc_no + " Quotation.pdf"); return; }
      var a = e.target.closest("button[data-qa]"); if (a) { var q = S.D.quotes[a.dataset.qa]; $("#qaBox").innerHTML = '<div class="card" style="margin-top:12px"><b>Accept quotation ' + E(q.doc_no) + " (KES " + n2(q.total) + ')?</b><p style="margin:6px 0">We will be told straight away and will confirm and schedule the work. Add your LPO number if you have one.</p><label>LPO / reference (optional)<input id="qaLpo" maxlength="60"></label><button class="btn" id="qaGo" data-id="' + q.id + '" type="button">Yes, accept it</button> <button class="btn line" style="color:var(--txt)" id="qaNo" type="button">Not now</button><p class="msg" id="qaM" role="status"></p></div>'; $("#qaBox").scrollIntoView({ block: "nearest" }); return; }
      if (e.target.id === "qaNo") { $("#qaBox").innerHTML = ""; return; }
      if (e.target.id === "qaGo") { var go = e.target; go.disabled = true; WEB.db.rpc("acct_request", { p_acc: S.cur.acc, p_phone: S.cur.phone, p: { kind: "accept", doc_id: Number(go.dataset.id), lpo_no: $("#qaLpo").value.trim() } }).then(function (r) { var d = r.data || {}; go.disabled = false; if (r.error || !d.ok) return msg($("#qaM"), why(d), "bad"); msg($("#qaM"), d.again ? "We already have your acceptance. Thank you." : "Thank you. We have your acceptance and will be in touch.", "ok"); setTimeout(function () { S.H.reload(); }, 1800); }); }
    };
    var f = $("#rqF"); if (f) f.onsubmit = function (e) {
      e.preventDefault(); var m = $("#rqM"), b = f.querySelector("button"); b.disabled = true; msg(m, "Sending…");
      WEB.db.rpc("acct_request", { p_acc: S.cur.acc, p_phone: S.cur.phone, p: { kind: "quote", subject: f.subject.value.trim(), details: f.details.value.trim(), lpo_no: f.lpo.value.trim() } }).then(function (r) {
        var d = r.data || {}; b.disabled = false; if (r.error || !d.ok) return msg(m, why(d), "bad"); msg(m, "Thank you. We have your request and will send a quotation.", "ok"); f.reset(); setTimeout(function () { S.H.reload(); }, 1800); });
    };
  }
  window.AcctX = {
    show: function (D, cur, H) {
      S.D = D; S.cur = cur; S.H = H;
      $("#xnav").innerHTML = '<a href="#s-quotes">Quotations</a><a href="#s-inv">Invoices</a><a href="#s-orders">Order from us</a><a href="#s-req">Ask for a quotation</a><a href="#s-st">Statement</a>';
      $("#xq").innerHTML = quotes(); $("#xo").innerHTML = orders() + requests();
      $("#invSum").innerHTML = invoiceSummary(); orderForm(); wire();
    }, tag: payTag
  };
})();
