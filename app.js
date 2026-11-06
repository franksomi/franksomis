"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const kes = v => v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("en-KE", { maximumFractionDigits: 2 });
const SHOP = { name: "Franksomi Solution Ltd", phone: "0711 952 924", email: "franksomi@gmail.com", place: "Kenya" };
const db = window.__MOCK_DB__ || supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
let catalog = [];
const ROLES = [
  ["owner", "Owner", "Everything, including users and permissions. Always has every permission."],
  ["manager", "Administrator / Manager", "Runs the shop day to day: everything except managing users. Cannot delete money records."],
  ["accountant", "Accountant", "Sees all money, buying costs and reports. Records payments, expenses and documents; reconciles M-Pesa. Cannot change stock."],
  ["technician", "Technician", "Works on repairs and field jobs and sees stock quantities. No prices, costs or money."],
  ["storekeeper", "Storekeeper", "Manages stock and suppliers and sees buying costs. Sees repairs only."],
  ["sales", "Sales / Receptionist", "Takes in repairs, sells, records payments and printing. Sees only their own recent money entries."],
  ["auditor", "Auditor / Viewer", "Can look at everything (read only). Changes nothing."]];
const roleName = r => (ROLES.find(x => x[0] === r) || [0, r])[1];
const can = p => !!me && String(p).split("+").every(x => (me.perms || []).includes(x));
const pm = (def, a) => def.perm === "suppliers" ? (a === "view" || can("suppliers.edit")) : can(def.perm + "." + a);
let accounts = [];
let me = null, lists = { item_type: [], brand: [], stock_type: [] }, stockItems = [], suppliers = [];

function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; setTimeout(() => t.style.display = "none", 3000); }
const must = r => { if (r.error) { toast(r.error.message); throw r.error; } return r.data; };

// ---- field/table definitions ------------------------------------------------
const PAY = ["Cash", "M-Pesa", "Bank"], PAYX = [...PAY, "On account"];
const LEFT_WITH = ["SIM", "Memory card", "Battery", "Charger", "Case"], CONDITION = ["Cracked screen", "Scratches", "Water damage", "Will not power on"];
const T = {
  repairs: { title: "Repairs", view: "v_repairs", perm: "repairs", table: "repairs", order: "id", print: "jobcard", mpay: "repair",
    cols: [["id", "Job no.", "jc"], ["received_on", "Received"], ["customer_name", "Customer"], ["contact", "Contact"], ["alt", "Alt. contact"], ["item_type", "Item"], ["brand_model", "Brand / model"], ["fault", "Fault"],
      ["stage", "Stage"], ["total_cost", "Total (KES)", "n"], ["balance_due", "Balance due", "n"], ["deposit_held", "Deposit held", "n"], ["status", "Status", "tag"]],
    fields: [["received_on", "Date received", "date", { today: 1 }], ["customer_name", "Customer name", "text", { req: 1 }], ["contact", "Contact", "text"],
      ["item_type", "Item type", "list:item_type"], ["brand_model", "Brand / model", "list:brand"], ["serial_no", "Serial no. / IMEI", "text"],
      ["stage", "Repair stage (customer sees this)", "select:Received,Diagnosing,Waiting for approval,Waiting for parts,Repairing,Testing,Ready for collection,Collected", { def: "Received" }], ["customer_note", "Message to customer (shown on the tracking page)", "text", { full: 1 }], ["sms_optout", "Do NOT send this customer SMS updates", "check"],
      ["alt_name", "Alternative contact: who (if the customer cannot be reached)", "text"], ["alt_phone", "Alternative contact: phone", "text"],
      ["fault", "Fault reported", "text", { full: 1 }], ["left_with", "Left with the device (tick what the customer handed in)", "multi:" + LEFT_WITH.join("|"), { full: 1 }],
      ["condition", "Condition on arrival", "multi:" + CONDITION.join("|"), { full: 1 }], ["diagnosis", "Diagnosis", "text", { full: 1 }],
      ["part1_id", "Part used 1 (from stock)", "stock"], ["part1_qty", "Qty", "number"], ["part2_id", "Part used 2 (from stock)", "stock"], ["part2_qty", "Qty", "number"],
      ["labor_hours", "Labor hours", "number"], ["labor_cost", "Labor cost (KES)", "number"],
      ["deposit_received", "Refundable deposit received", "number"], ["deposit_payment", "Deposit paid by", "select:" + PAY.join()], ["deposit_mpesa_ref", "Deposit M-Pesa code", "text"], ["deposit_applied", "Deposit applied to bill", "number"], ["deposit_refunded", "Deposit refunded", "number"],
      ["returned_on", "Date returned", "date"], ["remarks", "Remarks", "text", { full: 1 }]] },
  sales: { title: "Sales", view: "sales_v", perm: "sales", table: "sales", order: "id",
    cols: [["sold_on", "Date"], ["receipt_no", "Receipt no.", "cp"], ["customer", "Customer"], ["item_name", "Item"], ["qty", "Qty", "n"], ["unit_cost", "Unit cost", "n", "owner"], ["unit_price", "Unit price", "n"],
      ["total_sales", "Total", "n"], ["profit", "Profit", "n", "owner"], ["payment", "Payment", "pay"], ["account_id", "Account", "acct"], ["mpesa_ref", "M-Pesa code"]],
    fields: [["receipt_no", "Receipt no. (made for you; the items of one sale share it)", "text"], ["sold_on", "Date", "date", { today: 1 }], ["customer", "Customer", "text"], ["item_id", "Item (pick from stock: name, category and price fill in)", "stock", { full: 1 }],
      ["category", "Category", "list:stock_type"], ["qty", "Qty", "number", { req: 1 }], ["unit_price", "Unit price (KES)", "number", { req: 1 }],
      ["payment", "Payment method", "select:" + PAYX.join() + ",Split"], ["cash_amt", "Cash part (KES)", "number"], ["mpesa_amt", "M-Pesa part (KES)", "number"], ["account_id", "Credit account (choose when payment is On account)", "account"], ["mpesa_ref", "M-Pesa code (if paid by M-Pesa)", "text"], ["cost_new", "Unit cost for an item not in stock (KES)", "number", { owner: 1 }], ["notes", "Notes", "text", { full: 1 }]] },
  inventory: { title: "Inventory", view: "v_stock", perm: "inventory", table: "inventory_items", order: "code",
    cols: [["code", "Code"], ["description", "Description"], ["stock_type", "Type"], ["qty_received", "Received", "n"], ["qty_sold", "Sold", "n"], ["qty_used", "Used", "n"], ["on_hand", "On hand", "n"],
      ["unit_cost", "Unit cost", "n", "owner"], ["selling_price", "Selling price", "n"], ["stock_value", "Stock value", "n", "owner"], ["supplier", "Supplier"], ["shop_visible", "Online", "yn"], ["status", "Status", "tag"]],
    fields: [["description", "Description (keep unique)", "text", { req: 1, full: 1 }], ["stock_type", "Type", "list:stock_type", { req: 1 }], ["qty_received", "Qty received (total in)", "number"],
      ["unit_cost", "Unit cost (KES)", "number", { owner: 1 }], ["selling_price", "Selling price (KES)", "number"], ["supplier_id", "Supplier", "supplier"], ["reorder_level", "Reorder level", "number"], ["notes", "Notes", "text", { full: 1 }],
      ["shop_visible", "Sell this item in the online shop (needs a selling price and stock)", "check"], ["shop_featured", "Show as Popular on the website", "check"],
      ["shop_title", "Shop name (leave empty to use the description)", "text"], ["shop_image", "Photo (web address, or choose a file to upload)", "image", { full: 1 }], ["shop_desc", "Shop description (one or two sentences)", "text", { full: 1 }]] },
  jobs: { title: "Field Jobs", view: "v_jobs", perm: "jobs", table: "field_jobs", order: "id", print: "fieldcard", mpay: "job", margin: 1,
    cols: [["job_no", "Job No.", "cp"], ["started_on", "Started"], ["client_name", "Client"], ["site", "Site"], ["job_type", "Type"], ["contract_price", "Price", "n"], ["paid", "Paid", "n"], ["balance", "Balance", "n"], ["job_profit", "Job profit", "n", "owner"], ["status", "Stage", "tag"]],
    fields: [["started_on", "Date started", "date", { today: 1 }], ["client_name", "Client name", "text", { req: 1 }], ["contact", "Contact", "text"], ["site", "Site / location", "text"],
      ["job_type", "Job type", "select:Electrical installation,CCTV installation,Electrical repair,CCTV repair,Transport / logistics,Other"],
      ["contract_price", "Contract price (KES)", "number"], ["status", "Stage (customer sees this)", "select:Booked,Site visit,Quote sent,Waiting for materials,In progress,Testing,On hold,Completed", { def: "Booked" }], ["completed_on", "Date completed", "date"],
      ["customer_note", "Message to customer (shown on the tracking page)", "text", { full: 1 }], ["sms_optout", "Do NOT send this customer SMS updates", "check"], ["scope", "Scope of work", "text", { full: 1 }], ["remarks", "Remarks (private)", "text", { full: 1 }]] },
  income: { title: "Income", view: "income", perm: "income", table: "income", order: "received_on",
    cols: [["received_on", "Date"], ["ref", "Customer ID / Job No."], ["description", "Description"], ["amount", "Amount", "n"], ["payment", "Payment"], ["account_id", "Account", "acct"], ["mpesa_ref", "M-Pesa code"], ["income_type", "Type"]],
    fields: [["received_on", "Date", "date", { today: 1 }], ["ref", "Customer ID / Job No.", "text"], ["description", "Service description", "text", { full: 1 }], ["amount", "Amount (KES)", "number", { req: 1 }],
      ["payment", "Payment method", "select:" + PAYX.join()], ["account_id", "Credit account (choose when payment is On account)", "account"], ["income_type", "Income type", "select:Repair,Electrical installation,CCTV installation,Other service,Landlord WiFi"], ["mpesa_ref", "M-Pesa code", "text"], ["notes", "Notes", "text", { full: 1 }]] },
  expenses: { title: "Expenses", view: "expenses", perm: "expenses", table: "expenses", order: "spent_on",
    cols: [["spent_on", "Date"], ["description", "Description"], ["category", "Category"], ["amount", "Amount", "n"], ["payment", "Payment"], ["mpesa_ref", "M-Pesa code"], ["job_no", "Job No."]],
    fields: [["spent_on", "Date", "date", { today: 1 }], ["description", "Description", "text", { full: 1 }], ["category", "Category", "select:Job materials,Labor / Technician,Transport / Logistics,Fuel,Rent,Utilities,Stock purchase,Airtime / Internet,Landlord WiFi - Bandwidth,Landlord WiFi - Hardware,Landlord WiFi - Electricity,Landlord WiFi - SMS,Landlord WiFi - Software & domain,Landlord WiFi - Other,Marketing - Ads & social media,Marketing - Flyers & printing,Marketing - Promotions & gifts,Marketing - Signage & branding,Marketing - Sponsorship & events,Marketing - Other,Other"],
      ["amount", "Amount (KES)", "number", { req: 1 }], ["payment", "Payment method", "select:" + PAY.join()], ["mpesa_ref", "M-Pesa code", "text"], ["job_no", "Job No. (optional)", "text"], ["notes", "Notes", "text", { full: 1 }]] },
  services: { title: "Printing & Cyber", view: "services", perm: "services", table: "services", order: "id", quick: 1,
    cols: [["done_on", "Date"], ["service", "Service"], ["customer", "Customer"], ["qty", "Qty", "n"], ["unit_price", "Price", "n"], ["total", "Total", "n"], ["payment", "Payment"], ["account_id", "Account", "acct"], ["mpesa_ref", "M-Pesa code"]],
    fields: [["done_on", "Date", "date", { today: 1 }], ["service", "Service", "service"], ["customer", "Customer (optional)", "text"], ["qty", "Qty (pages, minutes ÷ 30, items)", "number", { req: 1 }],
      ["unit_price", "Price each (KES)", "number", { req: 1 }], ["payment", "Payment method", "select:" + PAYX.join()], ["account_id", "Credit account (choose when payment is On account)", "account"], ["mpesa_ref", "M-Pesa code (if paid by M-Pesa)", "text"], ["notes", "Notes", "text", { full: 1 }]] },
  enquiries: { title: "Website enquiries", view: "enquiries", perm: "orders", table: "enquiries", order: "id",
    cols: [["created_at", "Received", "dt"], ["name", "Name"], ["phone", "Phone"], ["topic", "About"], ["message", "Message"], ["status", "Status"], ["source", "From"]],
    fields: [["name", "Name", "text", { req: 1 }], ["phone", "Phone", "text", { req: 1 }], ["topic", "About", "text"], ["message", "Message", "text", { full: 1 }],
      ["status", "Status", "select:New,Contacted,Quoted,Won,Closed", { def: "New" }], ["notes", "Our notes (private)", "text", { full: 1 }]] },
  suppliers: { title: "Suppliers", view: "suppliers", perm: "suppliers", table: "suppliers", order: "name",
    cols: [["name", "Supplier"], ["contact_person", "Contact person"], ["phone", "Phone"], ["location", "Location"], ["supplies", "What they supply"]],
    fields: [["name", "Supplier name", "text", { req: 1 }], ["contact_person", "Contact person", "text"], ["phone", "Phone", "text"], ["location", "Location", "text"], ["supplies", "What they supply", "text", { full: 1 }], ["notes", "Notes", "text", { full: 1 }]] },
};
const NAV = [["dashboard", "Dashboard"], ["repairs", "Repairs", "repairs.view"], ["sales", "Sales", "sales.view"], ["orders", "Shop orders", "orders.view"], ["enquiries", "Enquiries", "orders.view"], ["chat", "Live chat", "chat.use"], ["accounts", "Credit accounts", "accounts.view"], ["services", "Printing & Cyber", "services.view"], ["jobs", "Field Jobs", "jobs.view"],
  ["docs", "Quotes / Invoices / Receipts", "docs.view"], ["contracts", "Contracts", "docs.view"], ["unpaid", "Unpaid invoices", "docs.view"], ["quotes", "Open quotes", "docs.view"], ["equipment", "Client equipment", "equipment.view"], ["till", "Till payments", "income.add"], ["wifi", "Landlord WiFi", "reports.view"], ["income", "Income", "income.view"], ["expenses", "Expenses", "expenses.view"], ["staffpay", "Staff pay", "payroll.manage"], ["inventory", "Inventory", "inventory.view"],
  ["mpay", "M-Pesa checkout", "mpay.use"], ["sms", "SMS messages", "sms.manage"], ["health", "Business health", "finance.view+costs.view"], ["assets", "Assets", "finance.view"], ["money", "Money & loans", "finance.view"], ["eod", "End of day", "eod.view"], ["monthly", "Monthly report", "reports.view+costs.view"], ["summary", "Year summary", "reports.view+costs.view"],
  ["mpesa", "M-Pesa reconcile", "reconcile.use"], ["suppliers", "Suppliers"], ["payables", "Supplier payables", "payables.view"], ["lists", "Lists", "lists.manage"], ["zones", "Delivery areas", "shop.manage"], ["audit", "Activity log", "audit.view"], ["vault", "Company documents", "vault.manage"], ["projects", "Website projects", "projects.manage"], ["policies", "Website policies", "settings.manage"], ["users", "Users & roles", "users.manage"]];
const navFor = () => NAV.filter(n => !n[2] || can(n[2]));

// ---- form widgets -----------------------------------------------------------
function widget([k, l, t, o = {}], v) {
  if (o.owner && !can("costs.view")) return "";
  const val = v ?? (o.today ? new Date().toISOString().slice(0, 10) : ""), req = o.req ? "required" : "", cls = o.full ? "full" : "";
  let inner;
  if (t === "text") inner = `<input name="${k}" value="${esc(val)}" ${req} autocomplete="off">`;
  else if (t === "number") inner = `<input name="${k}" type="number" step="any" min="0" value="${esc(val)}" ${req} inputmode="decimal">`;
  else if (t === "check") return `<label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="${k}" ${v ? "checked" : ""} style="width:auto"> ${esc(l)}</label>`;
  else if (t === "image") return `<label class="${cls}">${esc(l)}<input name="${k}" value="${esc(val)}" placeholder="https://…" autocomplete="off"><span style="display:flex;gap:10px;align-items:center;margin-top:6px"><input type="file" accept="image/*" data-img="${k}" style="flex:1"><img alt="" data-prev="${k}" src="${esc(val)}" style="height:44px;width:44px;object-fit:cover;border-radius:8px;${val ? "" : "display:none"}"></span><small data-imsg="${k}" style="color:var(--mut)"></small></label>`;
  else if (t.startsWith("multi:")) { const have = Array.isArray(v) ? v : []; return `<fieldset class="full multi"><legend>${esc(l)}</legend>${t.slice(6).split("|").map(x => `<label><input type="checkbox" name="${k}" value="${esc(x)}" ${have.includes(x) ? "checked" : ""}> ${esc(x)}</label>`).join("")}</fieldset>`; }
  else if (t === "date") inner = `<input name="${k}" type="date" value="${esc(val)}" ${req}>`;
  else if (t === "account") { if (!can("accounts.view")) return ""; inner = `<select name="${k}"><option value=""></option>${accounts.filter(a => a.active || String(a.id) === String(val)).map(a => `<option value="${a.id}" ${String(a.id) === String(val) ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>`; }
  else if (t.startsWith("select:")) { const sv = val || o.def || ""; if (!can("accounts.view")) t = t.replace(",On account", ""); inner = `<select name="${k}">${o.def ? "" : `<option value=""></option>`}${t.slice(7).split(",").map(x => `<option ${x === sv ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`; }
  else if (t.startsWith("list:")) { const id = "dl_" + k; inner = `<input name="${k}" list="${id}" value="${esc(val)}" ${req} autocomplete="off"><datalist id="${id}">${lists[t.slice(5)].map(x => `<option value="${esc(x.value)}">`).join("")}</datalist>`; }
  else if (t === "stock") inner = `<select name="${k}"><option value=""></option>${stockItems.map(i => `<option value="${i.id}" ${String(i.id) === String(val) ? "selected" : ""}>${esc(i.code)} – ${esc(i.description)} (${i.on_hand} in stock)</option>`).join("")}</select>`;
  else if (t === "service") inner = `<select name="${k}" required data-svc><option value=""></option>${catalog.map(c => `<option value="${esc(c.name)}" data-price="${c.default_price}" ${c.name === val ? "selected" : ""}>${esc(c.name)} (${esc(c.unit)})</option>`).join("")}</select>`;
  else if (t === "supplier") inner = `<select name="${k}"><option value=""></option>${suppliers.map(s => `<option value="${s.id}" ${String(s.id) === String(val) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>`;
  return `<label class="${cls}">${esc(l)}${inner}</label>`;
}
function readForm(form, fields) {
  const out = {};
  for (const [k, , t, o = {}] of fields) {
    if (o.owner && !can("costs.view")) continue;
    if (t === "account" && !form.elements[k]) continue;
    if (t === "check") { out[k] = form.elements[k].checked; continue; }
    if (t.startsWith("multi:")) { out[k] = [...form.querySelectorAll(`input[name="${k}"]:checked`)].map(x => x.value); continue; }
    const raw = form.elements[k].value.trim();
    out[k] = raw === "" ? null : (t === "number" || t === "stock" || t === "supplier" || t === "account") ? Number(raw) : raw;
  }
  return out;
}
// ---- extra item lines (several items in one sale, many parts on a repair) ----
const lineHtml = (kind, o = {}) => `<div class="xline" data-line>
  <select name="li_item" class="xi" aria-label="Item from stock"><option value=""></option>${stockItems.map(i => `<option value="${i.id}" data-price="${i.selling_price ?? 0}" ${String(i.id) === String(o.item_id) ? "selected" : ""}>${esc(i.code)} – ${esc(i.description)} (${i.on_hand} in stock)</option>`).join("")}</select>
  <input name="li_name" class="xn" placeholder="…or type an item not in stock" value="${o.item_id ? "" : esc(o.description || "")}" ${o.item_id ? "disabled" : ""} maxlength="120">
  <input name="li_qty" type="number" step="any" min="0.01" value="${o.qty ?? 1}" class="xq" title="Qty" aria-label="Qty">
  <input name="li_price" type="number" step="any" min="0" value="${o.unit_price ?? ""}" class="xp" placeholder="Price" title="Unit price (KES)" aria-label="Unit price">
  ${kind === "sales" && can("costs.view") ? `<input name="li_cost" type="number" step="any" min="0" class="xp" placeholder="Unit cost" title="Unit cost, for an item not in stock" aria-label="Unit cost">` : ""}
  <button type="button" class="btn sm warn" data-rm title="Remove this line">✕</button></div>`;
function linesBlock(kind, rows, title) {
  return `<div class="xbox"><h3>${title}</h3><div id="xlines">${rows.map(r => lineHtml(kind, r)).join("")}</div>
    <div class="bar"><button type="button" class="btn sm ghost" id="addline">+ Add ${kind === "sales" ? "another item" : "a part or item"}</button><span id="xsum" style="color:var(--mut)"></span></div></div>`;
}
function wireLines(f, kind) {
  const box = f.querySelector("#xlines"); if (!box) return;
  const sum = () => {
    let t = 0, n = 0;
    if (kind === "sales") { const q = Number(f.elements.qty?.value), p = Number(f.elements.unit_price?.value); if (q && p) { t += q * p; n++; } }
    box.querySelectorAll("[data-line]").forEach(l => { const q = Number(l.querySelector("[name=li_qty]").value), p = Number(l.querySelector("[name=li_price]").value); if (q && p) { t += q * p; n++; } });
    f.querySelector("#xsum").textContent = n > 1 || (kind === "repairs" && n) ? `${n} item${n === 1 ? "" : "s"}, KES ${kes(t)}${kind === "repairs" ? " (parts and items, before labour)" : " in total"}` : "";
  };
  box.onclick = e => { const b = e.target.closest("[data-rm]"); if (b) { b.closest("[data-line]").remove(); sum(); } };
  box.onchange = e => {
    const l = e.target.closest("[data-line]"); if (!l) return;
    if (e.target.name === "li_item") {
      const o = e.target.selectedOptions[0], nm = l.querySelector("[name=li_name]");
      nm.disabled = !!e.target.value; if (e.target.value) { nm.value = ""; const p = l.querySelector("[name=li_price]"); if (!Number(p.value) && o.dataset.price) p.value = o.dataset.price; }
    }
    sum();
  };
  box.oninput = sum;
  f.querySelector("#addline").onclick = () => { box.insertAdjacentHTML("beforeend", lineHtml(kind)); box.lastElementChild.querySelector("select").focus(); sum(); };
  if (kind === "sales") for (const n of ["qty", "unit_price"]) f.elements[n]?.addEventListener("input", sum);
  sum();
}
// read the extra lines; returns { lines } or { error }
function readLines(f) {
  const lines = [];
  for (const l of f.querySelectorAll("#xlines [data-line]")) {
    const item = l.querySelector("[name=li_item]").value, name = l.querySelector("[name=li_name]").value.trim();
    const qty = Number(l.querySelector("[name=li_qty]").value), pr = l.querySelector("[name=li_price]").value.trim(), cs = l.querySelector("[name=li_cost]")?.value.trim();
    if (!item && !name && !pr) continue;              // an empty line is ignored
    if (!item && !name) return { error: "A line has a price but no item. Pick an item or type its name." };
    if (!(qty > 0)) return { error: "Each line needs a quantity above zero." };
    if (!item && pr === "") return { error: `Enter a price for “${name}”.` };
    if (pr !== "" && !(Number(pr) >= 0)) return { error: "A price cannot be negative." };
    lines.push({ item_id: item ? Number(item) : null, description: item ? null : name, qty, unit_price: pr === "" ? null : Number(pr), cost: cs ? Number(cs) : null });
  }
  return { lines };
}
async function repairItems(id) {
  const r = await db.from("repair_items").select("*").eq("repair_id", id).order("id");
  return r.error ? [] : (r.data || []);
}
async function openForm(key, row) {
  const def = T[key];
  await refreshLookups();
  if (key === "repairs" && row) row = { ...row, ...(await repairChecks(row.id)) };
  const oldItems = key === "repairs" && row ? await repairItems(row.id) : [];
  const dlg = $("#dlg"), f = $("#dlgForm");
  f.innerHTML = `<h2>${row ? "Edit" : "New"} – ${esc(def.title)}</h2><div class="grid">${def.fields.map(fd => widget(fd, row && row[fd[0]])).join("")}</div>
    ${key === "sales" && !row ? linesBlock("sales", [], "More items on this sale") : key === "repairs" && (can("repairs.add") || can("repairs.edit")) ? linesBlock("repairs", oldItems, "More parts and items used (as many as you need)") : ""}
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  wireLines(f, key);
  if (key === "sales") { const pf = f.elements.payment; if (pf && row) pf.dataset.v = row.payment || ""; wireSaleSplit(f, !row);
    if (!row && f.elements.receipt_no && !f.elements.receipt_no.value) { const rn = await db.rpc("next_sale_receipt"); if (!rn.error && rn.data) f.elements.receipt_no.value = rn.data; } }
  f.oninput = f.onchange = f.onclick = null;
  const pasteFix = mpesaPasteFix(f); let billFn = null;
  if (key === "income" && !row) wireIncomeFill(f);
  if (key === "repairs" && !row) billFn = await wireRepairBill(f);
  f.oninput = e => { pasteFix(e); if (billFn) billFn(); };
  f.onsubmit = async e => {
    if (e.submitter.value !== "save") return;
    e.preventDefault();
    const data = readForm(f, def.fields);
    const xl = (key === "sales" && !row) || key === "repairs" ? readLines(f) : { lines: [] };
    if (xl.error) return toast(xl.error);
    const checks = key === "repairs" ? { left_with: data.left_with || [], condition: data.condition || [] } : null;
    const alt = key === "repairs" ? { alt_name: data.alt_name || null, alt_phone: data.alt_phone || null } : null;
    if (checks) { delete data.left_with; delete data.condition; delete data.alt_name; delete data.alt_phone; }
    if (def.fields.some(f => f[2] === "account") && "account_id" in data) {
      if (data.payment === "On account" && !data.account_id) return toast("Choose the credit account this is billed to.");
      if (data.payment !== "On account") data.account_id = null;
    }
    if (key === "sales") {
      if (data.receipt_no) data.receipt_no = data.receipt_no.toUpperCase().replace(/\s+/g, "");
      if (data.payment === "Split") {
        const lines = [{ qty: data.qty, price: data.unit_price }, ...(!row ? xl.lines.map(l => ({ qty: l.qty, price: l.unit_price ?? 0 })) : [])], tot = Math.round(lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.price || 0), 0) * 100) / 100;
        const cv = Number(data.cash_amt || 0), mv = Number(data.mpesa_amt || 0);
        if (Math.abs(cv + mv - tot) >= 0.005) return toast(`Cash KES ${kes(cv)} + M-Pesa KES ${kes(mv)} must add up to the sale total KES ${kes(tot)}.`);
        if (mv > 0 && !data.mpesa_ref) return toast("Type the M-Pesa code for the M-Pesa part.");
      } else { data.cash_amt = null; data.mpesa_amt = null; }
    }
    const costVal = key === "inventory" ? data.unit_cost : key === "sales" ? data.cost_new : undefined;
    delete data.unit_cost; delete data.cost_new;
    if (key === "repairs") { data.part1_qty ??= 1; data.part2_qty ??= 1; }
    for (const k of ["qty_received", "selling_price", "reorder_level"]) if (key === "inventory") data[k] ??= 0;
    if (key === "sales" && data.item_id == null && !row) { const nm = prompt("This sale has no stock item. Item name:"); if (!nm) return; data.item_name = nm; }
    if (key === "repairs" && data.deposit_received && !data.deposit_payment) data.deposit_payment = "Cash";
    if (data.mpesa_ref) data.mpesa_ref = data.mpesa_ref.toUpperCase().replace(/\s+/g, "");
    if (data.deposit_mpesa_ref) data.deposit_mpesa_ref = data.deposit_mpesa_ref.toUpperCase().replace(/\s+/g, "");
    let payload = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null));
    if (key === "sales" && !row && xl.lines.length) {      // several items on one sale: every line is saved together, or none
      const shared = { sold_on: data.sold_on, customer: data.customer, payment: data.payment, account_id: data.account_id, mpesa_ref: data.mpesa_ref, notes: data.notes, receipt_no: data.receipt_no };
      const extra = xl.lines.map(l => ({ ...shared, item_id: l.item_id, item_name: l.description, qty: l.qty, unit_price: l.unit_price ?? 0 }));
      const all = [payload, ...extra];
      if (data.payment === "Split") { let left = Math.round(Number(data.cash_amt || 0) * 100);      // cash fills the first items, M-Pesa the rest; one item may be shared between the two
        all.forEach(o => { const t = Math.round(Number(o.qty) * Number(o.unit_price) * 100), c = Math.min(t, left); left -= c; o.cash_amt = c / 100; o.mpesa_amt = (t - c) / 100; }); }
      const keys = [...new Set(all.flatMap(o => Object.keys(o)))];
      payload = all.map(o => Object.fromEntries(keys.map(k => [k, o[k] ?? null])));
    }
    const q = row ? db.from(def.table).update(data).eq("id", row.id).select("id") : db.from(def.table).insert(payload).select("id");
    const r = await q; if (r.error) return toast(r.error.message);
    if (row && (!r.data || !r.data.length)) return toast("You can't change this record. Staff can fix only their own entries, within a day.");
    if (checks) {
      const rid = row ? row.id : (Array.isArray(r.data) ? r.data[0]?.id : r.data?.id);
      if (rid) { const c = await db.from("repair_checks").upsert({ repair_id: rid, ...checks, updated_at: new Date().toISOString() }); if (c.error) return toast("Saved, but the checklist was not: " + c.error.message); }
    }
    if (key === "sales" && !row && xl.lines.length && Array.isArray(r.data)) {
      const cs = xl.lines.map((l, i) => l.cost != null && !l.item_id && r.data[i + 1] ? { sale_id: r.data[i + 1].id, unit_cost: l.cost } : null).filter(Boolean);
      if (cs.length) { const c = await db.from("sale_costs").upsert(cs); if (c.error) toast(c.error.message); }
    }
    if (alt && (row || alt.alt_name || alt.alt_phone)) {
      const rid = row ? row.id : (Array.isArray(r.data) ? r.data[0]?.id : r.data?.id);
      if (rid) { const c = await db.from("repair_contacts").upsert({ repair_id: rid, ...alt, updated_at: new Date().toISOString() }); if (c.error) return toast("Saved, but the alternative contact was not: " + c.error.message); }
    }
    if (key === "repairs") {
      const rid = row ? row.id : (Array.isArray(r.data) ? r.data[0]?.id : r.data?.id);
      const sig = l => [l.item_id || "", l.item_id ? "" : l.description, Number(l.qty), l.unit_price == null ? "" : Number(l.unit_price)].join("|"), now = xl.lines.map(sig).join(";"), was = oldItems.map(sig).join(";");
      if (rid && (now !== was)) {
        if (oldItems.length) { const d = await db.from("repair_items").delete().eq("repair_id", rid); if (d.error) return toast("Saved, but the parts list was not: " + d.error.message); }
        if (xl.lines.length) { const c = await db.from("repair_items").insert(xl.lines.map(l => ({ repair_id: rid, item_id: l.item_id, description: l.description, qty: l.qty, unit_price: l.unit_price }))); if (c.error) return toast("Saved, but the parts list was not: " + c.error.message); }
      }
    }
    if (costVal != null) {
      let id = row ? row.id : (Array.isArray(r.data) ? r.data[0]?.id : r.data?.id);
      if (id) { const c = await db.from(key === "inventory" ? "item_costs" : "sale_costs").upsert(key === "inventory" ? { item_id: id, unit_cost: costVal } : { sale_id: id, unit_cost: costVal }); if (c.error) toast(c.error.message); }
    }
    if (key === "expenses" && !row && can("inventory.edit") && can("costs.view") && f.elements.category && f.elements.category.value === "Stock purchase") {
      const nid = Array.isArray(r.data) ? r.data[0]?.id : r.data?.id; dlg.close(); toast("Saved"); route();
      if (nid) { const ex = await db.from("expenses").select("*").eq("id", nid); if (ex.data && ex.data[0] && confirm("Update the inventory with what you bought now? (You can also do it later with “Post to stock”.)")) expenseStockDialog(ex.data[0]); }
      return;
    }
    dlg.close(); toast("Saved"); route();
  };
  f.querySelectorAll("[data-img]").forEach(inp => inp.onchange = async () => {
    const file = inp.files[0], msg = f.querySelector(`[data-imsg="${inp.dataset.img}"]`); if (!file) return;
    if (!db.storage) { msg.textContent = "Photo upload is not available here. Paste a web address instead."; return; }
    if (file.size > 3 * 1024 * 1024) { msg.textContent = "That photo is over 3 MB. Please choose a smaller one."; inp.value = ""; return; }
    msg.textContent = "Uploading…"; const path = Date.now() + "-" + file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
    const up = await db.storage.from("shop").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { msg.textContent = "Upload failed: " + up.error.message + " (run database/shop_storage.sql once, see the guide)"; return; }
    const url = db.storage.from("shop").getPublicUrl(path).data.publicUrl; f.elements[inp.dataset.img].value = url;
    const pv = f.querySelector(`[data-prev="${inp.dataset.img}"]`); pv.src = url; pv.style.display = ""; msg.textContent = "Uploaded.";
  });
  if (key === "sales" && !row && f.elements.item_id) f.elements.item_id.addEventListener("change", () => {
    const it = stockItems.find(i => String(i.id) === f.elements.item_id.value), up = f.elements.unit_price; if (!it) return;
    if (it.stock_type && (!f.elements.category.value || f.elements.category.dataset.auto)) { f.elements.category.value = it.stock_type; f.elements.category.dataset.auto = "1"; }
    if (it.selling_price && (!Number(up.value) || up.dataset.auto)) { up.value = it.selling_price; up.dataset.auto = "1"; up.dispatchEvent(new Event("input", { bubbles: true })); }
    let h = f.querySelector("#itemhint"); if (!h) { f.elements.item_id.closest("label").insertAdjacentHTML("beforeend", `<small id="itemhint" style="color:var(--mut)"></small>`); h = f.querySelector("#itemhint"); }
    h.textContent = `${it.on_hand} in stock · price KES ${kes(it.selling_price)}${it.unit_cost != null && can("costs.view") ? " · cost KES " + kes(it.unit_cost) : ""}${Number(it.on_hand) < 1 ? " · NONE LEFT IN STOCK" : ""}`; });
  if (key === "sales" && !row) { f.elements.unit_price.addEventListener("input", e => { if (e.isTrusted) delete e.target.dataset.auto; }); f.elements.category.addEventListener("input", e => { if (e.isTrusted) delete e.target.dataset.auto; }); }
  const sv = f.querySelector("[data-svc]"); if (sv) sv.onchange = () => { const o = sv.selectedOptions[0]; if (o && o.dataset.price && !row) f.elements.unit_price.value = o.dataset.price; };
  dlg.showModal();
}


// ---- staff pay: salaries, wages, commissions and advances ----
const PAYKINDS = { Salary: "Salaries", Wage: "Wages", Commission: "Commissions", Advance: "Staff advances" };
async function staffPayPage() {
  const rows = must(await db.from("staff_pay").select("*").order("paid_on", { ascending: false }).order("id", { ascending: false }).limit(2000)) || [];
  const pf = await db.from("profiles").select("full_name,active"), staff = ((pf.error ? [] : pf.data) || []).filter(p => p.full_name && p.active !== false).map(p => p.full_name);
  const people = [...new Set([...rows.map(r => r.person), ...staff])].sort((a, b) => a.localeCompare(b));
  const bal = {}; rows.forEach(r => { const k = r.person.toLowerCase(), o = bal[k] = bal[k] || { name: r.person, given: 0, back: 0 }; if (r.kind === "Advance") o.given += Number(r.gross); o.back += Number(r.recovered); });
  const owing = Object.values(bal).map(o => ({ ...o, left: Math.round((o.given - o.back) * 100) / 100 })).filter(o => o.left > 0).sort((a, b) => b.left - a.left);
  const ym = iso(new Date()).slice(0, 7), yr = ym.slice(0, 4), net = r => Number(r.gross) - Number(r.recovered);
  const sum = (kind, pre) => rows.filter(r => r.kind === kind && r.paid_on.startsWith(pre)).reduce((t, r) => t + net(r), 0);
  const MN = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], per = p => p ? MN[Number(p.slice(5, 7))] + " " + p.slice(0, 4) : "";
  window.__pay = rows;
  $("#view").innerHTML = `<h2>Staff pay</h2><p style="color:var(--mut);margin-top:0">Salaries, wages, commissions and advances. Each payment is also recorded in <b>Expenses</b> (${Object.values(PAYKINDS).join(", ")}), so profit and the day's cash already include it. An advance is counted when it is given; when it is later recovered from pay, only the cash actually paid is counted, so nothing is counted twice.</p>
    <div class="bar"><button class="btn" id="sp_new">+ Pay someone</button><input id="q" placeholder="Search…" style="max-width:240px"><span style="color:var(--mut)">${rows.length} payments</span></div>
    <div class="cards">${Object.keys(PAYKINDS).map(k => `<div class="card"><small>${esc(PAYKINDS[k])} this month</small><b>KES ${kes(sum(k, ym))}</b><small>this year KES ${kes(sum(k, yr))}</small></div>`).join("")}</div>
    ${owing.length ? `<h3>Advances not yet recovered</h3><div class="wrap"><table><thead><tr><th>Person</th><th>Given</th><th>Recovered</th><th>Still owed to you</th></tr></thead><tbody>${owing.map(o => `<tr><td><b>${esc(o.name)}</b></td><td class="n">${kes(o.given)}</td><td class="n">${kes(o.back)}</td><td class="n"><b>${kes(o.left)}</b></td></tr>`).join("")}</tbody></table></div>` : ""}
    <h3>Payments</h3><div class="wrap"><table><thead><tr><th>Date</th><th>Person</th><th>Type</th><th>For</th><th>Amount</th><th>Advance recovered</th><th>Paid out</th><th>How</th><th></th></tr></thead><tbody id="tb">${rows.map((r, i) => `<tr><td>${esc(r.paid_on)}</td><td>${esc(r.person)}</td><td>${esc(r.kind)}</td><td>${esc(per(r.period))}</td><td class="n">${kes(r.gross)}</td><td class="n">${Number(r.recovered) ? kes(r.recovered) : ""}</td><td class="n"><b>${kes(net(r))}</b></td><td>${esc(r.payment || "")}${r.mpesa_ref ? " " + esc(r.mpesa_ref) : ""}</td><td><button class="btn sm warn" data-del="${i}">Delete</button></td></tr>`).join("") || `<tr><td colspan="9"><div class="empty">${BRAND.emptyArt(130)}No staff payments yet. Press “+ Pay someone”.</div></td></tr>`}</tbody></table></div>`;
  $("#q").oninput = e => { const t = e.target.value.toLowerCase(); document.querySelectorAll("#tb tr").forEach(tr => tr.hidden = !tr.textContent.toLowerCase().includes(t)); };
  $("#sp_new").onclick = () => staffPayDialog(people, bal);
  $("#tb").onclick = async e => { const b = e.target.closest("[data-del]"); if (!b) return; const r = rows[b.dataset.del];
    if (!confirm(`Delete this ${r.kind.toLowerCase()} of KES ${kes(r.gross)} for ${r.person}? Its entry in Expenses is removed too.`)) return;
    const x = await db.rpc("staff_pay_delete", { p_id: r.id }); if (x.error) return toast(x.error.message); toast("Deleted"); staffPayPage(); };
}
function staffPayDialog(people, bal) {
  const f = $("#dlgForm"); f.oninput = f.onchange = f.onclick = null;
  f.innerHTML = `<h2>Pay someone</h2><div class="grid">
    <label>Date<input name="date" type="date" value="${iso(new Date())}" required></label>
    <label>Who<input name="person" list="sp_people" autocomplete="off" required placeholder="Name"><datalist id="sp_people">${people.map(p => `<option value="${esc(p)}">`).join("")}</datalist></label>
    <label>Type<select name="kind"><option>Salary</option><option>Wage</option><option>Commission</option><option>Advance</option></select></label>
    <label id="sp_perl">For the month of<input name="period" type="month" value="${iso(new Date()).slice(0, 7)}"></label>
    <div class="full box" id="sp_comm" hidden style="margin:0">Commission helper: sales of KES <input name="base" type="number" min="0" step="any" style="width:130px"> at <input name="rate" type="number" min="0" step="any" style="width:80px"> % <button type="button" class="btn sm ghost" id="sp_calc">Work it out</button></div>
    <label>Amount (KES)<input name="gross" type="number" min="0.01" step="0.01" required inputmode="decimal"></label>
    <label id="sp_recl">Advance to recover from this (KES)<input name="rec" type="number" min="0" step="0.01" inputmode="decimal" value=""></label>
    <div class="full" id="sp_owe" style="color:var(--mut)"><span id="sp_owetxt"></span> <button type="button" class="btn sm ghost" id="sp_all" hidden>Recover it</button></div>
    <div class="full" id="sp_net" style="font-weight:600"></div>
    <label>Paid by<select name="pay"><option>Cash</option><option>M-Pesa</option><option>Bank</option></select></label>
    <label>M-Pesa code (if paid by M-Pesa)<input name="code" autocomplete="off" placeholder="SGH7K2L9XQ"></label>
    <label class="full">Note (optional)<input name="note" autocomplete="off"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save payment</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  const el = f.elements, num = n => Number(el[n].value) || 0, r2 = v => Math.round(v * 100) / 100, owed = () => { const o = bal[String(el.person.value).trim().replace(/\s+/g, " ").toLowerCase()]; return o ? r2(o.given - o.back) : 0; };
  const upd = () => {
    const adv = el.kind.value === "Advance"; $("#sp_perl").hidden = adv; $("#sp_recl").hidden = adv; $("#sp_comm").hidden = el.kind.value !== "Commission";
    const ow = owed(); $("#sp_owetxt").innerHTML = ow > 0 && !adv ? `${esc(el.person.value.trim())} still owes <b>KES ${kes(ow)}</b> from earlier advances.` : adv && ow > 0 ? `${esc(el.person.value.trim())} already owes KES ${kes(ow)} from earlier advances.` : ""; $("#sp_all").hidden = !(ow > 0 && !adv);
    const rec = adv ? 0 : num("rec"), n = num("gross") - rec; $("#sp_net").innerHTML = num("gross") > 0 ? (rec > num("gross") ? `<span class="tag bad">The advance recovered is more than the amount</span>` : rec > ow + 0.001 ? `<span class="tag bad">Only KES ${kes(ow)} is owed</span>` : `Cash to pay out now: KES ${kes(r2(n))}`) : "";
  };
  f.oninput = f.onchange = e => { if (e.target.name === "code" && e.target.value.length > 14) { const p = parseMpesa(e.target.value); if (p.code) { e.target.value = p.code; el.pay.value = "M-Pesa"; } } upd(); };
  f.onclick = e => { if (e.target.id === "sp_all") { el.rec.value = Math.min(owed(), num("gross") || owed()); upd(); } if (e.target.id === "sp_calc") { if (num("base") > 0 && num("rate") > 0) { el.gross.value = r2(num("base") * num("rate") / 100); upd(); } } };
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const adv = el.kind.value === "Advance", rec = adv ? 0 : num("rec"), gross = num("gross");
    if (gross <= 0) return toast("Enter the amount."); if (rec > gross) return toast("The advance recovered cannot be more than the amount.");
    if (gross - rec > 0 && el.pay.value === "M-Pesa" && !el.code.value.trim() && !confirm("No M-Pesa code typed. Save without it?")) return;
    const x = await db.rpc("staff_pay_post", { p_person: el.person.value, p_kind: el.kind.value, p_gross: gross, p_recover: rec, p_payment: gross - rec > 0 ? el.pay.value : null, p_mpesa_ref: el.code.value.trim() || null, p_date: el.date.value || null, p_period: adv || !el.period.value ? null : el.period.value + "-01", p_note: el.note.value.trim() || null });
    if (x.error) return toast(x.error.message);
    $("#dlg").close(); toast(`Saved. ${x.data.person}: KES ${kes(x.data.net)} paid out` + (Number(x.data.advance_balance) > 0 ? `, advance still owed KES ${kes(x.data.advance_balance)}` : "")); staffPayPage(); };
  upd(); $("#dlg").showModal();
}
// ---- copy a job / receipt number for pasting elsewhere (for example into an income entry) ----
function copyText(txt) {
  const ok = () => toast("Copied " + txt), old = () => { const t = document.createElement("textarea"); t.value = txt; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); let good = false; try { good = document.execCommand("copy"); } catch (_) {} t.remove(); good ? ok() : toast("Could not copy. Select it and copy by hand: " + txt); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, old); else old();
}
// ---- sales: one receipt for the items of a sale, with cash + M-Pesa split ----
async function printSaleReceipt(r) {
  const q = await db.from("sales_v").select("*").eq("receipt_no", r.receipt_no).order("id", { ascending: true }); if (q.error) return toast(q.error.message);
  const ls = q.data || [r]; await loadCompany();
  const total = ls.reduce((s, x) => s + Number(x.total_sales || 0), 0), cash = ls.reduce((s, x) => s + (x.payment === "Cash" ? Number(x.total_sales) : x.payment === "Split" ? Number(x.cash_amt || 0) : 0), 0),
    mp = ls.reduce((s, x) => s + (x.payment === "M-Pesa" ? Number(x.total_sales) : x.payment === "Split" ? Number(x.mpesa_amt || 0) : 0), 0), bank = ls.reduce((s, x) => s + (x.payment === "Bank" ? Number(x.total_sales) : 0), 0), acct = ls.reduce((s, x) => s + (x.payment === "On account" ? Number(x.total_sales) : 0), 0);
  const codes = [...new Set(ls.map(x => x.mpesa_ref).filter(Boolean))].join(", ");
  const paid = [cash > 0 ? "Cash " + kes(cash) : "", mp > 0 ? "M-Pesa " + kes(mp) + (codes ? " (" + codes + ")" : "") : "", bank > 0 ? "Bank " + kes(bank) : "", acct > 0 ? "On account " + kes(acct) : ""].filter(Boolean).join(" + ");
  const doc = { doc_type: "Receipt", doc_no: r.receipt_no, customer: ls[0].customer || "Walk-in customer", doc_date: ls[0].sold_on, reference: paid ? "Paid: " + paid : "", items: ls.map(x => ({ desc: x.item_name || "Item", qty: Number(x.qty), price: Number(x.unit_price) })), discount: 0, vat_rate: 0, paid_before: total - acct, status: "Issued" };
  printHtml(docPrintHtml(doc), r.receipt_no + " receipt.pdf");
}
function wireSaleSplit(f, isNew) {
  const pay = f.elements.payment, c = f.elements.cash_amt, m = f.elements.mpesa_amt; if (!pay || !c || !m) return;
  const opt = [...pay.options].find(o => o.value === "Split" || o.textContent === "Split"); if (opt) { opt.value = "Split"; opt.textContent = "Cash + M-Pesa (split)"; }
  if (pay.dataset.v) pay.value = pay.dataset.v;
  const boxes = [c, m].map(x => x.closest("label")); boxes[1].insertAdjacentHTML("afterend", `<div class="full" id="splitnote" style="color:var(--mut);font-size:13px" hidden></div>`);
  const note = f.querySelector("#splitnote"), r2 = v => Math.round(v * 100) / 100;
  const total = () => { let t = Number(f.elements.qty.value || 0) * Number(f.elements.unit_price.value || 0); if (isNew) f.querySelectorAll("[data-line]").forEach(l => { t += Number(l.querySelector("[name=li_qty]").value || 0) * Number(l.querySelector("[name=li_price]").value || 0); }); return r2(t); };
  const show = () => { const on = pay.value === "Split"; boxes.forEach(b => b.hidden = !on); note.hidden = !on; if (on) upd(); };
  const upd = () => { const t = total(), cv = Number(c.value || 0), mv = Number(m.value || 0); note.textContent = `Sale total KES ${kes(t)}. Cash ${kes(cv)} + M-Pesa ${kes(mv)} = ${kes(r2(cv + mv))}${Math.abs(cv + mv - t) < 0.005 ? " ✓" : "  (must add up to the total)"}`; };
  c.addEventListener("input", () => { m.value = String(Math.max(0, r2(total() - Number(c.value || 0)))); upd(); });
  m.addEventListener("input", () => { c.value = String(Math.max(0, r2(total() - Number(m.value || 0)))); upd(); });
  f.addEventListener("input", e => { if (pay.isConnected && pay.value === "Split" && e.target !== c && e.target !== m) upd(); });
  pay.addEventListener("change", show); show();
}

// ---- table pages ------------------------------------------------------------
async function tablePage(key) {
  const def = T[key];
  const rows = must(await db.from(def.view).select("*").order(def.order, { ascending: false }).limit(500)) || [];
  if (key === "repairs") {   // alternative contacts, shown beside the main contact
    const ac = await db.from("repair_contacts").select("*"), m = new Map(((ac.error ? [] : ac.data) || []).map(x => [x.repair_id, x]));
    rows.forEach(r => { const x = m.get(r.id); r.alt = x ? [x.alt_name, x.alt_phone].filter(Boolean).join(" ") : ""; r.alt_name = x?.alt_name || null; r.alt_phone = x?.alt_phone || null; });
  }
  window.__rows = rows;
  let stk = null; if (key === "expenses" && can("inventory.edit") && can("costs.view")) { stk = new Set(); try { const sp = await db.from("expense_stock").select("expense_id"); ((sp && sp.data) || []).forEach(x => stk.add(x.expense_id)); } catch (_) { stk = null; } }
  const cols = def.cols.filter(c => (c[3] !== "owner" || can("costs.view")) && (c[2] !== "acct" || can("accounts.view")));
  const head = cols.map(c => `<th>${esc(c[1])}</th>`).join("") + "<th></th>";
  const body = rows.map((r, i) => `<tr class="${r.status === "REORDER" ? "low" : ""}">${cols.map(([k, , t]) => {
    const v = r[k]; if (t === "cp" || t === "jc") { const no = t === "jc" ? "JC-" + String(v).padStart(4, "0") : v; return `<td>${esc(no)}${no ? ` <button type="button" class="cp" data-cp="${esc(no)}" title="Copy ${esc(no)}" aria-label="Copy ${esc(no)}">⧉</button>` : ""}</td>`; }
    if (t === "pay") return `<td>${v === "Split" ? `Cash ${kes(r.cash_amt)} + M-Pesa ${kes(r.mpesa_amt)}` : esc(v)}</td>`;
    if (t === "tag") return `<td><span class="tag ${v === "REORDER" || v === "In shop" ? "bad" : "ok"}">${esc(v)}</span></td>`;
    return `<td class="${t === "n" ? "n" : ""}">${t === "n" ? kes(v) : t === "dt" ? esc(String(v || "").replace("T", " ").slice(0, 16)) : t === "yn" ? (v ? "Yes" : "") : t === "acct" ? esc(acctName(v)) : esc(v)}</td>`; }).join("")}
    <td>${pm(def, "edit") ? `<button class="btn sm" data-edit="${i}">Edit</button>` : ""} ${def.print ? `<button class="btn sm pbtn" data-print="${i}">Print card</button>` : ""}${key === "sales" && r.receipt_no ? `<button class="btn sm ghost" data-rcpt="${i}">Receipt</button>` : ""}
    ${def.margin && can("costs.view") ? `<button class="btn sm ghost" data-mg="${i}">Margin</button>` : ""}${((key === "repairs" && ["Ready for collection", "Collected"].includes(r.stage) && Number(r.balance_due) > 0) || (key === "jobs" && r.status === "Completed" && Number(r.balance) > 0)) && can("income.add") ? `<button class="btn sm" style="background:#12b76a" data-pi="${i}">Post income</button>` : ""}${key === "jobs" && r.status === "Completed" && can("projects.manage") ? `<button class="btn sm ghost" data-wp="${i}">Show on website</button>` : ""}${def.mpay && can("mpay.use") ? `<button class="btn sm" style="background:#12b76a" data-pay="${i}">M-Pesa</button>` : ""}${def.mpay === "repair" ? ` <button class="btn sm wabtn" data-wa="${i}">Send tracking link</button>` : ""}
    ${stk && r.category === "Stock purchase" ? (stk.has(r.id) ? `<button class="btn sm ghost" data-stku="${i}" title="Take this purchase back out of the inventory">In stock · Undo</button>` : `<button class="btn sm ghost" data-stk="${i}">Post to stock</button>`) : ""}
    ${pm(def, "delete") ? `<button class="btn sm warn" data-del="${i}">Delete</button>` : ""}</td></tr>`).join("");
  if (def.quick) await refreshLookups();
  const quickBar = def.quick ? `<div class="bar" id="quick">${catalog.filter(c => c.active).map(c => `<button class="btn sm ghost" data-svc="${esc(c.name)}" title="KES ${c.default_price} per ${esc(c.unit)}">${esc(c.name.split(" (")[0])}</button>`).join("")}</div>` : "";
  $("#view").innerHTML = `<h2>${esc(def.title)}</h2>${quickBar}<div class="bar">${pm(def, "add") ? `<button class="btn" id="add">+ New</button>` : ""}${key === "income" && can("income.add") ? `<button class="btn ghost" id="addsplit">+ From a repair or job (cash + M-Pesa)</button>` : ""}<input id="q" placeholder="Search…" style="max-width:260px"><span style="color:var(--mut)">${rows.length} rows</span></div>
    <div class="wrap"><table><thead><tr>${head}</tr></thead><tbody id="tb">${body || `<tr><td colspan="99"><div class="empty">${BRAND.emptyArt(130)}Nothing yet. Press “+ New”.</div></td></tr>`}</tbody></table></div>`;
  if ($("#add")) $("#add").onclick = () => openForm(key);
  if ($("#addsplit")) $("#addsplit").onclick = () => postIncomeDialog({});
  const qk = $("#quick"); if (qk) qk.onclick = async e => { const b = e.target.closest("[data-svc]"); if (!b) return; await openForm(key); const sel = $("#dlgForm").elements.service; sel.value = b.dataset.svc; sel.onchange(); $("#dlgForm").elements.qty.value = 1; };
  $("#q").oninput = e => { const s = e.target.value.toLowerCase(); document.querySelectorAll("#tb tr").forEach(tr => tr.hidden = !tr.textContent.toLowerCase().includes(s)); };
  $("#tb").onclick = async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.cp) return copyText(b.dataset.cp);
    if (b.dataset.rcpt) return printSaleReceipt(rows[b.dataset.rcpt]);
    if (b.dataset.stk) return expenseStockDialog(rows[b.dataset.stk]);
    if (b.dataset.stku) { if (!confirm("Take this purchase back out of the inventory? Quantities and unit costs go back as they were.")) return; const x = await db.rpc("expense_stock_undo", { p_expense_id: rows[b.dataset.stku].id }); if (x.error) return toast(x.error.message); toast("Taken out of the inventory"); return route(); }
    if (b.dataset.edit) openForm(key, rows[b.dataset.edit]);
    if (b.dataset.del && confirm("Delete this record? This cannot be undone.")) { const r = await db.from(def.table).delete().eq("id", rows[b.dataset.del].id); if (r.error) toast(r.error.message); else route(); }
    if (b.dataset.print) { let r = rows[b.dataset.print]; if (def.print === "jobcard") r = { ...r, ...(await repairChecks(r.id)), items: await repairItems(r.id) }; printCard(def.print, r); }
    if (b.dataset.mg) marginDialog("field_job", rows[b.dataset.mg]);
    if (b.dataset.wp) projectDialog(rows[b.dataset.wp], null);
    if (b.dataset.pi) { const r = rows[b.dataset.pi]; postIncomeDialog({ ref: key === "repairs" ? "JC-" + String(r.id).padStart(4, "0") : r.job_no }); }
    if (b.dataset.pay) { const r = rows[b.dataset.pay]; mpayDialog(def.mpay === "repair"
      ? { phone: r.contact, amount: Math.max(0, Math.floor(r.balance_due || 0)) || "", ref: "JC-" + String(r.id).padStart(4, "0"), purpose: "Repair payment", auto: true, name: r.customer_name }
      : { phone: r.contact, amount: Math.max(0, Math.floor(r.balance || 0)) || "", ref: r.job_no, purpose: "Job payment " + r.job_no, auto: true, name: r.client_name }); }
    if (b.dataset.wa) { const r = rows[b.dataset.wa], no = "JC-" + String(r.id).padStart(4, "0"), ph = String(r.contact || "").replace(/\D/g, "").replace(/^0/, "254");
      const msg = `Hello ${String(r.customer_name || "").split(" ")[0]}, track your repair (${no}) here: ${portalUrl(no)} — use the phone number you gave us. ${SHOP.name}, ${SHOP.phone}`;
      window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(msg), "_blank"); }
  };
}


// ---- online shop orders -----------------------------------------------------
const ORDER_FLOW = { delivery: ["Placed", "Confirmed", "Packed", "Dispatched", "Out for delivery", "Delivered"], pickup: ["Placed", "Confirmed", "Packed", "Ready for pickup", "Collected"] };
const orderNo = id => "ORD-" + String(id).padStart(4, "0");
const trackUrl = no => new URL("track.html", (window.APP_CONFIG && APP_CONFIG.SITE_URL) || location.href).href.split("?")[0] + "?order=" + encodeURIComponent(no);
async function ordersPage() {
  const rows = must(await db.from("shop_orders").select("*").order("id", { ascending: false }).limit(300)) || [];
  const ids = rows.map(r => r.id), items = ids.length ? (must(await db.from("shop_order_items").select("*").in("order_id", ids)) || []) : [];
  const by = {}; items.forEach(i => (by[i.order_id] = by[i.order_id] || []).push(i));
  const open = r => !["Delivered", "Collected", "Cancelled"].includes(r.status);
  let filt = sessionStorage.getItem("ordf") || "open";
  const sumItems = r => (by[r.id] || []).map(i => `${i.name} × ${Number(i.qty)}`).join(", ");
  const draw = () => {
    const q = ($("#oq") ? $("#oq").value : "").toLowerCase(), list = rows.filter(r => (filt === "all" || (filt === "open" ? open(r) : filt === "done" ? ["Delivered", "Collected"].includes(r.status) : r.status === "Cancelled")) && (!q || (orderNo(r.id) + r.customer_name + r.phone + sumItems(r)).toLowerCase().includes(q)));
    $("#otb").innerHTML = list.map(r => `<tr><td><b>${orderNo(r.id)}</b></td><td>${esc(String(r.created_at).replace("T", " ").slice(0, 16))}</td><td>${esc(r.customer_name)}<br><small>${esc(r.phone)}</small></td><td><small>${esc(sumItems(r))}</small></td>
      <td>${r.fulfil === "pickup" ? "Pickup" : esc(r.zone_name || "Delivery")}</td><td class="n">${kes(r.total)}</td><td class="n">${kes(r.paid)}</td><td><span class="tag ${r.status === "Cancelled" ? "bad" : open(r) ? "" : "ok"}">${esc(r.status)}</span></td>
      <td><button class="btn sm" data-open="${r.id}">Open</button></td></tr>`).join("") || `<tr><td colspan="9"><div class="empty">${BRAND.emptyArt(130)}No orders here yet.</div></td></tr>`;
    document.querySelectorAll("[data-of]").forEach(b => b.classList.toggle("ghost", b.dataset.of !== filt));
  };
  $("#view").innerHTML = `<h2>Shop orders</h2><p style="color:var(--mut);margin-top:0">Orders placed on the website. Move each order along its stages: the customer sees every change on their tracking page and gets the SMS you switched on.</p>
    <div class="bar"><button class="btn sm" data-of="open">To handle</button><button class="btn sm" data-of="done">Delivered / collected</button><button class="btn sm" data-of="cancelled">Cancelled</button><button class="btn sm" data-of="all">All</button><input id="oq" placeholder="Search order, name, phone, item…" style="max-width:280px"><span style="color:var(--mut)">${rows.filter(open).length} open</span></div>
    <div class="wrap"><table><thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Total</th><th>Paid</th><th>Stage</th><th></th></tr></thead><tbody id="otb"></tbody></table></div>`;
  draw(); $("#oq").oninput = draw;
  $("#view").onclick = e => {
    const f = e.target.closest("[data-of]"); if (f) { filt = f.dataset.of; sessionStorage.setItem("ordf", filt); draw(); return; }
    const o = e.target.closest("[data-open]"); if (o) orderDialog(rows.find(r => String(r.id) === o.dataset.open), by[o.dataset.open] || []);
  };
}
function orderDialog(o, items) {
  const no = orderNo(o.id), flow = ORDER_FLOW[o.fulfil], done = ["Delivered", "Collected"].includes(o.status), canEdit = can("orders.edit");
  const bal = Math.max(Number(o.total) - Number(o.paid), 0), ph = String(o.phone || "").replace(/\D/g, "");
  const f = $("#dlgForm"), dis = !canEdit || done ? "disabled" : "";
  f.innerHTML = `<h2>${no} <span class="tag ${o.status === "Cancelled" ? "bad" : done ? "ok" : ""}">${esc(o.status)}</span></h2>
    <div class="grid"><div class="full"><b>${esc(o.customer_name)}</b> · <a href="tel:+${ph}">${esc(o.phone)}</a>${o.email ? " · " + esc(o.email) : ""}<br>${o.fulfil === "pickup" ? "<b>Pickup at the shop</b>" : `<b>Deliver to:</b> ${esc(o.zone_name)} · ${esc(o.address || "")}`}${o.notes ? `<br><i>Customer note: ${esc(o.notes)}</i>` : ""}</div>
    <div class="full wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(i.name)}</td><td class="n">${Number(i.qty)}</td><td class="n">${kes(i.unit_price)}</td><td class="n">${kes(i.qty * i.unit_price)}</td></tr>`).join("")}
      <tr><td colspan="3">Delivery fee</td><td class="n">${kes(o.delivery_fee)}</td></tr><tr><td colspan="3"><b>Total</b></td><td class="n"><b>${kes(o.total)}</b></td></tr></tbody></table></div>
    <label>Paid so far (KES) <small>(M-Pesa prompts add themselves; type cash you received)</small><input name="paid" type="number" min="0" step="1" value="${Number(o.paid)}" ${canEdit && !done ? "" : "disabled"}></label>
    <div style="align-self:end;padding-bottom:10px">Balance to collect: <b>${kes(bal)}</b> · ${o.pay_method === "mpesa_now" ? "customer chose M-Pesa now" : "customer pays on " + (o.fulfil === "pickup" ? "pickup" : "delivery")}</div>
    <label>Stage (customer sees this)<select name="status" ${dis}>${[...flow, "Cancelled"].map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <label>Message to customer (shown on the tracking page)<input name="customer_note" value="${esc(o.customer_note || "")}" ${dis}></label>
    ${o.fulfil === "delivery" ? `<label>Rider / courier name<input name="courier" value="${esc(o.courier || "")}" ${dis}></label><label>Rider / courier phone<input name="courier_phone" value="${esc(o.courier_phone || "")}" ${dis}></label><label class="full">Courier reference / waybill (optional)<input name="tracking_ref" value="${esc(o.tracking_ref || "")}" ${dis}></label>` : ""}
    <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="sms_optout" ${o.sms_optout ? "checked" : ""} style="width:auto" ${canEdit ? "" : "disabled"}> Do NOT send this customer SMS updates</label>
    ${done ? `<p class="full" style="color:var(--mut)">Delivered orders are final: the sale and stock were recorded on ${esc(o.delivered_on || "")}.</p>` : ""}</div>
    <div class="bar" style="margin-top:14px">${canEdit && !done ? `<button class="btn" value="save">Save</button>` : ""}${canEdit && !done && o.status !== "Cancelled" && flow.indexOf(o.status) < flow.length - 1 ? `<button class="btn" style="background:#12b76a" value="next">Save and move to “${flow[flow.indexOf(o.status) + 1]}”</button>` : ""}
      ${can("mpay.use") && bal > 0 && o.status !== "Cancelled" ? `<button class="btn" type="button" id="opay" style="background:#12b76a">M-Pesa prompt</button>` : ""}<a class="btn wabtn" target="_blank" rel="noopener" href="https://wa.me/${ph.replace(/^0/, "254")}?text=${encodeURIComponent(`Hello ${String(o.customer_name).split(" ")[0]}, about your Franksomi order ${no}: ${trackUrl(no)}`)}">WhatsApp</a>
      ${can("orders.delete") ? `<button class="btn warn" value="del" formnovalidate>Delete</button>` : ""}<button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
  const dlg = $("#dlg"); const op = $("#opay"); if (op) op.onclick = () => { dlg.close(); mpayDialog({ phone: o.phone, amount: Math.floor(bal), ref: no, purpose: "Shop order " + no, auto: true, name: o.customer_name }); };
  f.onsubmit = async e => {
    const act = e.submitter && e.submitter.value; if (act === "cancel" || !act) return;
    e.preventDefault();
    if (act === "del") { if (!confirm("Delete this order for good? Use Cancelled instead if you want to keep a record.")) return; const r = await db.from("shop_orders").delete().eq("id", o.id); if (r.error) return toast(r.error.message); dlg.close(); return route(); }
    const el = f.elements; let status = el.status.value; if (act === "next") status = flow[flow.indexOf(o.status) + 1];
    const paid = Number(el.paid.value || 0);
    if (status === "Cancelled" && Number(o.paid) > 0 && !confirm(`The customer already paid KES ${kes(o.paid)}. Cancel anyway? You must refund them yourself by M-Pesa.`)) return;
    if (["Delivered", "Collected"].includes(status) && !confirm(`Mark ${no} as ${status.toLowerCase()}?\nThis records the sale, takes the items out of stock${Number(o.total) - paid > 0 ? `, and counts the unpaid KES ${kes(Number(o.total) - paid)} as cash received` : ""}. It cannot be undone.`)) return;
    const upd = { status, customer_note: el.customer_note.value.trim() || null, paid, sms_optout: el.sms_optout.checked };
    if (el.courier) { upd.courier = el.courier.value.trim() || null; upd.courier_phone = el.courier_phone.value.trim() || null; upd.tracking_ref = el.tracking_ref.value.trim() || null; }
    const r = await db.from("shop_orders").update(upd).eq("id", o.id).select("id"); if (r.error) return toast(r.error.message);
    if (!r.data || !r.data.length) return toast("You can't change this order.");
    dlg.close(); toast("Saved"); route();
  };
  dlg.showModal();
}
async function zonesPage() {
  const z = must(await db.from("delivery_zones").select("*").order("sort", { ascending: true })) || [];
  $("#view").innerHTML = `<h2>Delivery areas</h2><p style="color:var(--mut);margin-top:0">What customers choose at checkout on the website. The fee is added to the order. “Pickup” areas are free collections at the shop. Switch an area off to hide it. These fees are examples: set your own.</p>
    <div class="wrap"><table><thead><tr><th>Area</th><th>Kind</th><th>Fee (KES)</th><th>Delivery time shown</th><th>Order</th><th>On</th><th></th></tr></thead><tbody>${z.map(x => `<tr data-z="${x.id}"><td><input name="name" value="${esc(x.name)}"></td>
      <td><select name="kind"><option value="delivery" ${x.kind === "delivery" ? "selected" : ""}>Delivery</option><option value="pickup" ${x.kind === "pickup" ? "selected" : ""}>Pickup</option></select></td><td><input name="fee" type="number" min="0" step="1" value="${x.fee}" style="width:100px"></td>
      <td><input name="eta" value="${esc(x.eta || "")}"></td><td><input name="sort" type="number" step="1" value="${x.sort}" style="width:70px"></td><td><input name="active" type="checkbox" ${x.active ? "checked" : ""} style="width:auto"></td><td><button class="btn sm" data-save>Save</button> <button class="btn sm warn" data-del>Delete</button></td></tr>`).join("")}</tbody></table></div>
    <form id="zadd" class="bar"><input name="name" placeholder="New area (for example Estate X, by rider)" required><input name="fee" type="number" min="0" step="1" placeholder="Fee" style="width:100px" required><input name="eta" placeholder="Delivery time, e.g. Same day"><button class="btn sm">Add area</button></form>`;
  $("#view").onclick = async e => {
    const tr = e.target.closest("tr[data-z]"); if (!tr) return; const g = n => tr.querySelector(`[name=${n}]`);
    if (e.target.closest("[data-save]")) { const r = await db.from("delivery_zones").update({ name: g("name").value.trim(), kind: g("kind").value, fee: Number(g("fee").value || 0), eta: g("eta").value.trim() || null, sort: Number(g("sort").value || 0), active: g("active").checked }).eq("id", Number(tr.dataset.z)); return r.error ? toast(r.error.message) : toast("Saved"); }
    if (e.target.closest("[data-del]") && confirm("Delete this area? Past orders keep their own copy of the name.")) { const r = await db.from("delivery_zones").delete().eq("id", Number(tr.dataset.z)); return r.error ? toast(r.error.message) : zonesPage(); }
  };
  $("#view").onsubmit = async e => { e.preventDefault(); const f = e.target; const r = await db.from("delivery_zones").insert({ name: f.name.value.trim(), kind: "delivery", fee: Number(f.fee.value), eta: f.eta.value.trim() || null, sort: 50 }); if (r.error) toast(r.error.message); else zonesPage(); };
}

// ---- dashboard --------------------------------------------------------------
const dnice = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
const dshort = v => v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + "M" : v >= 1e3 ? (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + "k" : String(Math.round(v));
const PALETTE = ["#0d6eae", "#12b76a", "#ff914d", "#7a5af8", "#1a8f7a", "#f5b97a", "#e5484d"];
// horizontal bars: rows = [{ l: label, v: number, c?: colour, t?: text shown at the end }]
function hbars(rows, colour = "#0d6eae") {
  rows = rows.filter(r => Number(r.v) > 0); if (!rows.length) return `<p style="color:var(--mut);margin:6px 0">Nothing to show yet.</p>`;
  const mx = Math.max(...rows.map(r => Number(r.v)));
  return `<div class="hb">${rows.map(r => `<div class="hbr"><span class="hbl" title="${esc(r.l)}">${esc(r.l)}</span><span class="hbt"><i style="width:${Math.max(3, Number(r.v) / mx * 100)}%;background:${r.c || colour}"></i></span><b>${esc(r.t ?? kes(r.v))}</b></div>`).join("")}</div>`;
}
// last 14 days: income and expenses side by side
function dayChart(days) {
  const W = 640, H = 210, L = 40, B = 176, T = 12, top = dnice(Math.max(1, ...days.map(d => Math.max(Number(d.income), Number(d.expenses)))));
  const y = v => B - (v / top) * (B - T), step = (W - L - 6) / days.length, bw = Math.min(14, step / 2 - 2);
  const grid = [0, 1, 2, 3, 4].map(i => { const v = top * i / 4; return `<line x1="${L}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--mut)">${dshort(v)}</text>`; }).join("");
  const cols = days.map((d, i) => { const cx = L + step * i + step / 2, inc = Number(d.income), ex = Number(d.expenses), dd = String(d.d).slice(8, 10);
    return `<g><title>${esc(d.d)}: income KES ${Math.round(inc).toLocaleString("en-KE")}, expenses KES ${Math.round(ex).toLocaleString("en-KE")}</title><rect x="${cx - bw - 1}" y="${y(inc)}" width="${bw}" height="${Math.max(0, B - y(inc))}" rx="2" fill="#0d6eae"/><rect x="${cx + 1}" y="${y(ex)}" width="${bw}" height="${Math.max(0, B - y(ex))}" rx="2" fill="#ff914d"/><text x="${cx}" y="${B + 15}" text-anchor="middle" font-size="11" fill="var(--mut)">${dd}</text></g>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Income and expenses for each of the last 14 days">${grid}${cols}</svg><div class="legend"><span><i style="background:#0d6eae"></i>Income</span><span><i style="background:#ff914d"></i>Expenses</span></div>`;
}
const delta = (now, before, goodUp = true) => {
  now = Number(now), before = Number(before); if (!before) return now ? `<span class="dl">new this month</span>` : "";
  const p = Math.round((now - before) / before * 100); if (!p) return `<span class="dl">same as last month so far</span>`;
  const good = goodUp ? p > 0 : p < 0; return `<span class="dl ${good ? "up" : "dn"}">${p > 0 ? "▲" : "▼"} ${Math.abs(p)}% vs same days last month</span>`;
};
async function dashboard() {
  const yr = Number(sessionStorage.getItem("yr")) || new Date().getFullYear();
  const d = must(await db.rpc("dashboard", { yr }));
  const exr = await db.rpc("dashboard_extra", { yr }); const ex = (exr && !exr.error && exr.data) || {};   // older databases without v16 still work
  let pipe = "", sm = null;
  if (can("repairs.view")) { const rr = (await db.from("v_repairs").select("stage,returned_on").limit(2000)).data || []; const c = {}; rr.filter(x => !x.returned_on && x.stage !== "Collected").forEach(x => c[x.stage || "Received"] = (c[x.stage || "Received"] || 0) + 1); pipe = BRAND.pipeline(c); }
  if (can("reports.view+costs.view")) { const r = await db.rpc("summary_report", { yr }); sm = r.data || null; }
  const k = (l, v, ic, cls, money, sub) => `<div class="card kpi ${cls || ""}"><span class="ico">${BRAND.icon(ic, 20)}</span><small>${l}</small><b>${money ? "KES " + kes(v) : v}</b>${sub ? `<div>${sub}</div>` : ""}</div>`;
  const hr = new Date().getHours(), hi = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening", first = String(me.full_name || "").split(" ")[0];
  const pay = sm ? ["cash_in", "mpesa_in", "bank_in"].map((f, i) => ({ n: ["Cash", "M-Pesa", "Bank"][i], c: ["#0d6eae", "#12b76a", "#ff914d"][i], v: (sm.months || []).reduce((s, m) => s + Number(m[f] || 0), 0) })) : null;
  const src = sm && sm.lines ? Object.entries(sm.lines).map(([n, v], i) => ({ n, v: Number(v), c: PALETTE[i % PALETTE.length] })).filter(p => p.v > 0).sort((a, b) => b.v - a.v) : null;
  // things that need someone to act today
  const att = [];
  const add = (n, text, href, ic) => { if (Number(n) > 0) att.push(`<a class="att" href="#${href}">${BRAND.icon(ic, 18)}<b>${n}</b><span>${esc(text)}</span></a>`); };
  add(ex.repairs_ready, "repair(s) ready: call the customer", "repairs", "repairs");
  add(ex.repairs_old, "repair(s) in the shop over 14 days", "repairs", "repairs");
  add(d.reorder, "item(s) to reorder", "inventory", "inventory");
  add(d.orders_open, "online order(s) to handle", "orders", "orders");
  add(d.enquiries_new, "new website enquiry(ies)", "enquiries", "enquiries");
  add(d.chat_waiting, "live chat(s) waiting", "chat", "chat");
  if (ex.quotes) add(ex.quotes.due, "quotation(s) to follow up", "quotes", "docs");
  add(ex.till_pending, "customer payment(s) to the till waiting for you to confirm", "till", "income");
  add(ex.warranty_soon, "equipment warranty(ies) ending within 30 days", "equipment", "equipment");
  if (ex.vault) { add(ex.vault.expired, "company document(s) expired", "vault", "vault"); add(ex.vault.expiring, "company document(s) expiring within 30 days", "vault", "vault"); }
  add(ex.etims_missing, "issued invoice(s) / credit note(s) missing an eTIMS number", "docs", "docs");
  if (ex.payables) add(Number(ex.payables.overdue) > 0 ? 1 : 0, "supplier bill(s) overdue: KES " + kes(ex.payables.overdue), "payables", "payables");
  if (ex.payables && Number(ex.payables.due7) > Number(ex.payables.overdue)) add(1, "KES " + kes(Number(ex.payables.due7) - Number(ex.payables.overdue)) + " supplier bills due this week", "payables", "payables");
  if (ex.receivables) add(Number(ex.receivables.overdue) > 0 ? 1 : 0, "credit account balance(s) over 30 days: KES " + kes(ex.receivables.overdue), "accounts", "accounts");
  const owedIn = (ex.receivables ? Number(ex.receivables.owed) : 0) + (d.owner ? Number(d.owed || 0) : 0), owedOut = ex.payables ? Number(ex.payables.owed) : 0;
  const topTbl = (title, rows, href) => rows && rows.length ? `<div class="panel"><h3>${title}</h3><table><tbody>${rows.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${kes(r.balance)}</td><td class="n">${Number(r.overdue) > 0 ? `<span class="tag bad">${kes(r.overdue)} late</span>` : ""}</td></tr>`).join("")}</tbody></table><p style="margin:8px 0 0"><a href="#${href}">Open the full list</a></p></div>` : "";
  let unp = ""; if (can("docs.view")) try { const ib = await invBalances(), op = Object.values(ib).filter(b => b.origin !== "import" && Number(b.balance) > 0.005);
    if (op.length) { const tot = op.reduce((s, b) => s + Number(b.balance), 0), old = op.filter(b => b.age_days > 30).reduce((s, b) => s + Number(b.balance), 0);
      unp = `<div class="panel"><h3>Unpaid invoices</h3><div class="cards"><a class="card" href="#unpaid" style="text-decoration:none;color:inherit"><small>Owed on invoices</small><b>KES ${kes(tot)}</b><br><small>${op.length} invoice(s)</small></a><a class="card" href="#unpaid" style="text-decoration:none;color:inherit"><small>Older than 30 days</small><b style="${old ? "color:#b42318" : ""}">KES ${kes(old)}</b></a></div></div>`; } } catch (_) { unp = ""; }
  let fin = ""; if (can("finance.view")) try { const bh = await db.rpc("business_alerts"), bsr = await db.rpc("balance_sheet"), ms = can("costs.view") ? await db.rpc("income_statement", { p_from: iso(new Date()).slice(0, 8) + "01", p_to: iso(new Date()) }) : null;
    if (!bsr.error && bsr.data) { const b = bsr.data, pr = ms && ms.data ? ms.data.net_profit : null, al = bh.data || [];
      fin = `<div class="panel"><h3>The three questions</h3><div class="cards">${pr !== null ? `<a class="card" href="#health" style="text-decoration:none;color:inherit"><small>1 · Making money? (this month)</small><b style="${fTone(pr)}">${Number(pr) >= 0 ? "Yes" : "No"} · KES ${fSign(pr)}</b></a>` : ""}<a class="card" href="#money" style="text-decoration:none;color:inherit"><small>2 · Money we have</small><b>KES ${fSign(b.cash.total)}</b></a><a class="card" href="#health" style="text-decoration:none;color:inherit"><small>3 · Owns / owes</small><b>KES ${kes(b.assets.total)} / ${kes(b.liabilities.total)}</b><br><small>Net worth KES ${fSign(b.net_worth)}</small></a></div></div>
        <div class="panel"><h3>Business alerts <span class="tag">${al.length}</span></h3>${alertList(al.slice(0, 8))}${al.length > 8 ? `<p style="margin:8px 0 0"><a href="#health">See all ${al.length}</a></p>` : ""}</div>`; } } catch (_) { fin = ""; }   // database not yet upgraded to v26
  $("#view").innerHTML = `<div class="hero"><div class="row1"><img src="logo.png" alt="" width="64" height="64"><div><h2>${hi}${first ? ", " + esc(first) : ""}</h2><p>${esc(new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))} · ${esc(roleName(me.role))}</p><span class="tagline">${BRAND.TAGLINE}</span></div></div></div>
    <div class="bar"><label>Year <input id="yr" type="number" value="${yr}" style="width:100px"></label></div>
    ${fin}${unp}<div class="panel" id="attn"><h3>Needs attention</h3>${att.length ? `<div class="attrow">${att.join("")}</div>` : `<p style="margin:0;color:#067647">All clear. Nothing is waiting for you.</p>`}</div>
    <div class="cards">${k("Repairs still in shop", d.in_shop, "repairs")}${k("Jobs in progress", d.jobs_open, "jobs")}${k("Items to reorder", d.reorder, "inventory", "o")}${d.orders_open != null ? k("Online orders to handle", d.orders_open, "orders", d.orders_open ? "o" : "") : ""}${d.accounts_owed != null && d.accounts_owed > 0 ? k("Owed by credit accounts", d.accounts_owed, "accounts", "o", 1) : ""}${d.chat_waiting ? k("Live chats waiting", d.chat_waiting, "chat", "o") : ""}${d.enquiries_new ? k("New website enquiries", d.enquiries_new, "enquiries", "o") : ""}</div>
    ${d.owner ? `<div class="cards">${ex.income_month != null ? k("Income this month", ex.income_month, "income", "g", 1, delta(ex.income_month, ex.income_last_same, true)) + k("Expenses this month", ex.expenses_month, "expenses", "o", 1, delta(ex.expenses_month, ex.expenses_last_same, false)) : ""}${k("Total income (year)", d.income, "income", "g", 1)}${k("Total expenses (year)", d.expenses, "expenses", "o", 1)}${k("Cash profit (year)", d.profit, "profit", "g", 1)}${k("Owed by clients", d.owed, "owed", "o", 1)}${k("Customer deposits held", d.deposits_held, "deposit", "", 1)}${ex.stock_value != null ? k("Stock on the shelf (at cost)", ex.stock_value, "inventory", "", 1) : ""}</div>`
      : `<p style="color:var(--mut)">Money totals are shown only to roles that may see reports.</p>`}
    ${ex.payables || ex.receivables ? `<div class="charts"><div class="panel"><h3>Owed to you and by you</h3>${hbars([{ l: "Owed to you (customers)", v: owedIn, c: "#12b76a", t: "KES " + kes(owedIn) }, { l: "Of which over 30 days", v: ex.receivables ? ex.receivables.overdue : 0, c: "#e5484d", t: "KES " + kes(ex.receivables ? ex.receivables.overdue : 0) }, { l: "You owe suppliers", v: owedOut, c: "#ff914d", t: "KES " + kes(owedOut) }, { l: "Of which overdue", v: ex.payables ? ex.payables.overdue : 0, c: "#e5484d", t: "KES " + kes(ex.payables ? ex.payables.overdue : 0) }])}
      ${ex.payables && ex.receivables ? `<p style="margin:10px 0 0">Net: <b>KES ${kes(owedIn - owedOut)}</b> <small style="color:var(--mut)">(what customers owe you minus what you owe suppliers)</small></p>` : ""}</div>
      ${topTbl("Customers who owe most", ex.receivables && ex.receivables.top, "accounts")}${topTbl("Suppliers you owe most", ex.payables && ex.payables.top, "payables")}</div>` : ""}
    <div class="charts">${ex.daily ? `<div class="panel wide"><h3>Last 14 days: income and expenses</h3>${dayChart(ex.daily)}</div>` : ""}${pipe ? `<div class="panel"><h3>Repairs in the shop, by stage</h3>${pipe}</div>` : ""}
      ${src && src.length ? `<div class="panel"><h3>Where income comes from (${yr})</h3>${BRAND.donut(src, "Income")}</div>` : ""}${sm ? `<div class="panel"><h3>Money received by payment method (${yr})</h3>${BRAND.donut(pay, "Received")}</div>` : ""}
      ${ex.expense_cats ? `<div class="panel"><h3>Where the money goes (${yr})</h3>${hbars(ex.expense_cats.map(x => ({ l: x.category, v: x.amount })), "#ff914d")}</div>` : ""}
      ${ex.quotes && (Number(ex.quotes.open) || ex.quotes.rate != null) ? `<div class="panel"><h3>Quotations</h3><p style="margin:0 0 6px"><b>${ex.quotes.open}</b> open, worth <b>KES ${kes(ex.quotes.open_value)}</b></p><p style="margin:0">Win rate, last 12 months: <b>${ex.quotes.rate == null ? "not enough yet" : ex.quotes.rate + "%"}</b>${ex.quotes.rate == null ? "" : ` <small style="color:var(--mut)">(${ex.quotes.won} won · ${ex.quotes.lost} lost · ${ex.quotes.expired} expired)</small>`}</p><p style="margin:8px 0 0"><a href="#quotes">Open quotations</a></p></div>` : ""}
      ${ex.wifi && (Number(ex.wifi.this_month) || Number(ex.wifi.last_month)) ? `<div class="panel"><h3>Landlord WiFi</h3><p style="margin:0 0 6px">This month <b>KES ${kes(ex.wifi.this_month)}</b> · ${fmtBytes(ex.wifi.bytes_this)}</p><p style="margin:0">Last month <b>KES ${kes(ex.wifi.last_month)}</b> · ${fmtBytes(ex.wifi.bytes_last)}</p><p style="margin:8px 0 0"><small style="color:var(--mut)">Figures up to ${esc(ex.wifi.last_day || "")}</small> · <a href="#wifi">Landlord WiFi</a></p></div>` : ""}
      ${ex.top_items ? `<div class="panel"><h3>Best sellers, last 30 days</h3>${hbars(ex.top_items.map(x => ({ l: x.item, v: x.sales, t: "KES " + kes(x.sales) })), "#12b76a")}</div>` : ""}
      ${ex.jobs_stage && ex.jobs_stage.length ? `<div class="panel"><h3>Field jobs, by stage</h3>${hbars(ex.jobs_stage.map(x => ({ l: x.stage, v: x.n, t: String(x.n) })))}</div>` : ""}
      ${ex.orders_stage && ex.orders_stage.length ? `<div class="panel"><h3>Online orders still open, by stage</h3>${hbars(ex.orders_stage.map(x => ({ l: x.stage, v: x.n, t: String(x.n) })), "#7a5af8")}</div>` : ""}
      ${ex.low_stock && ex.low_stock.length ? `<div class="panel"><h3>Running low</h3><table><tbody>${ex.low_stock.map(x => `<tr><td>${esc(x.item)}</td><td class="n"><span class="tag bad">${Number(x.on_hand)} left</span></td><td class="n"><small>reorder at ${Number(x.reorder)}</small></td></tr>`).join("")}</tbody></table><p style="margin:8px 0 0"><a href="#inventory">Open stock</a></p></div>` : ""}</div>
    ${sm ? `<div class="panel"><h3>Income and expenses by month (${yr})</h3><div style="overflow-x:auto"><div style="min-width:560px;max-width:820px;margin:auto">${BRAND.bars(sm.months || [])}</div></div></div>` : ""}
    <h3 style="margin:6px 0 8px">Go to</h3><div class="tiles">${navFor().slice(1).map(([k2, l]) => `<a class="tile" href="#${k2}">${BRAND.icon(k2, 20)}${esc(l)}</a>`).join("")}</div>`;
  $("#yr").onchange = e => { sessionStorage.setItem("yr", e.target.value); route(); };
}

// ---- credit accounts (customers who pay at the end of the month) ---------------------------
const acctNo = id => "ACC-" + String(id).padStart(4, "0");
const acctName = id => { if (id == null || id === "") return ""; const a = accounts.find(x => String(x.id) === String(id)); return a ? a.name : acctNo(id); };
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
async function accountsPage() {
  if (can("accounts.edit")) { const rr = await db.rpc("recurring_run", {}); if (!rr.error && rr.data && rr.data.posted) toast(rr.data.posted + " monthly charge(s) posted to accounts"); }
  if (can("docs.issue")) { try { const cr = await db.rpc("contract_run", {}); if (cr && !cr.error && cr.data && cr.data.posted) toast(cr.data.posted + " contract charge(s) posted to accounts"); } catch (_) {} }
  const rows = must(await db.from("credit_balances").select("*").order("name")) || [], edit = can("accounts.edit");
  const owed = rows.reduce((s, r) => s + Math.max(Number(r.balance), 0), 0), over = rows.reduce((s, r) => s + Math.max(Number(r.overdue), 0), 0);
  let showAll = sessionStorage.getItem("acall") === "1";
  const draw = () => {
    const q = ($("#aq") ? $("#aq").value : "").toLowerCase(), list = rows.filter(r => (showAll || r.active || Number(r.balance) !== 0) && (!q || (r.name + r.phone + r.contact_person + r.acc_no).toLowerCase().includes(q)));
    $("#atb").innerHTML = list.map(r => `<tr class="${r.active ? "" : "low"}"><td><b>${esc(r.name)}</b><br><small>${esc(r.acc_no)}${r.active ? "" : " · switched off"}</small></td><td>${esc(r.contact_person || "")}<br><small>${esc(r.phone || "")}</small></td>
      <td class="n"><b>${kes(r.balance)}</b></td><td class="n">${Number(r.overdue) > 0 ? `<span class="tag bad">${kes(r.overdue)}</span>` : ""}</td><td class="n">${Number(r.credit_limit) ? kes(r.credit_limit) : "none"}</td><td>${esc(r.last_payment || "")}</td>
      <td><button class="btn sm" data-st="${r.id}">Statement</button> ${edit ? `<button class="btn sm" style="background:#12b76a" data-rc="${r.id}">Receive payment</button> <button class="btn sm ghost" data-ch="${r.id}">Charge</button> <button class="btn sm ghost" data-ed="${r.id}">Edit</button>` : ""}</td></tr>`).join("")
      || `<tr><td colspan="7"><div class="empty">${BRAND.emptyArt(130)}No credit accounts yet. Press “+ New account” for a customer who pays at month end.</div></td></tr>`;
  };
  $("#view").innerHTML = `<h2>Credit accounts</h2><p style="color:var(--mut);margin-top:0">For customers billed at the end of the month. Choose <b>On account</b> as the payment method when you record a sale, printing/cyber entry or repair payment, or use <b>Charge</b> below. Open <b>Statement</b> at month end to print or SMS it, and use <b>Receive payment</b> when they pay.</p>
    <div class="cards"><div class="card"><small>Total owed to you</small><b>KES ${kes(owed)}</b></div><div class="card"><small>Older than 30 days</small><b>KES ${kes(over)}</b></div><div class="card"><small>Accounts</small><b>${rows.filter(r => r.active).length}</b></div></div>
    <div class="bar">${edit ? `<button class="btn" id="anew">+ New account</button><button class="btn ghost" id="asms">SMS balance reminders</button>` : ""}<button class="btn ghost" id="arec">Monthly charges</button><input id="aq" placeholder="Search…" style="max-width:240px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="aall" ${showAll ? "checked" : ""} style="width:auto"> Show switched-off</label></div>
    <div class="wrap"><table><thead><tr><th>Account</th><th>Contact</th><th>Balance (KES)</th><th>Over 30 days</th><th>Limit</th><th>Last paid</th><th></th></tr></thead><tbody id="atb"></tbody></table></div>`;
  draw(); $("#aq").oninput = draw; $("#aall").onchange = e => { showAll = e.target.checked; sessionStorage.setItem("acall", showAll ? "1" : "0"); draw(); };
  const byId = id => rows.find(r => String(r.id) === String(id));
  if ($("#anew")) $("#anew").onclick = () => accountForm(null);
  if ($("#arec")) $("#arec").onclick = recurringDialog;
  if ($("#asms")) $("#asms").onclick = async () => { if (!confirm("Send every account that owes money an SMS with its balance?")) return; const r = await db.rpc("account_send_statements", {}); if (r.error) return toast(r.error.message); toast(`${r.data.queued} reminder(s) queued`); };
  $("#atb").onclick = e => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.st) statementDialog(byId(b.dataset.st)); if (b.dataset.rc) receiveDialog(byId(b.dataset.rc)); if (b.dataset.ch) chargeDialog(byId(b.dataset.ch)); if (b.dataset.ed) accountForm(byId(b.dataset.ed)); };
}
async function accountForm(a) {
  const f = $("#dlgForm"), dlg = $("#dlg");
  if (a && a.kra_pin === undefined) { const pr = await db.from("credit_accounts").select("kra_pin").eq("id", a.id); if (!pr.error) a = { ...a, kra_pin: ((Array.isArray(pr.data) ? pr.data[0] : pr.data) || {}).kra_pin || null }; }
  f.innerHTML = `<h2>${a ? "Edit" : "New"} credit account</h2><div class="grid">
    <label class="full">Customer / business name<input name="name" value="${esc(a?.name || "")}" required></label><label>Contact person<input name="contact_person" value="${esc(a?.contact_person || "")}"></label>
    <label>Phone (for SMS)<input name="phone" value="${esc(a?.phone || "")}" inputmode="tel"></label><label>Email<input name="email" value="${esc(a?.email || "")}"></label><label>Credit limit (KES, 0 = no limit)<input name="credit_limit" type="number" min="0" step="1" value="${Number(a?.credit_limit || 0)}"></label>
    <label>KRA PIN (printed on invoices)<input name="kra_pin" value="${esc(a?.kra_pin || "")}" maxlength="11" placeholder="e.g. P051234567Z" autocomplete="off"></label><label class="full">Address<input name="address" value="${esc(a?.address || "")}"></label><label class="full">Notes (private)<input name="notes" value="${esc(a?.notes || "")}"></label>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" ${!a || a.active ? "checked" : ""} style="width:auto"> Account is active (can be charged)</label>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="sms_optout" ${a?.sms_optout ? "checked" : ""} style="width:auto"> Do NOT send this customer SMS</label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const el = f.elements;
    const d = { name: el.name.value.trim(), contact_person: el.contact_person.value.trim() || null, phone: el.phone.value.trim() || null, email: el.email.value.trim() || null, address: el.address.value.trim() || null,
      notes: el.notes.value.trim() || null, credit_limit: Number(el.credit_limit.value || 0), active: el.active.checked, sms_optout: el.sms_optout.checked };
    const pin = el.kra_pin.value.trim().toUpperCase().replace(/\s+/g, ""); if (pin && !/^[A-Z][0-9]{9}[A-Z]$/.test(pin)) return toast("A KRA PIN looks like P051234567Z: a letter, 9 digits and a letter.");
    if (pin || (a && a.kra_pin !== undefined)) d.kra_pin = pin || null;
    const r = a ? await db.from("credit_accounts").update(d).eq("id", a.id).select("id") : await db.from("credit_accounts").insert(d).select("id"); if (r.error) return toast(r.error.message);
    dlg.close(); toast("Saved"); await refreshLookups(); route(); };
  dlg.showModal();
}
function receiveDialog(a) {
  const f = $("#dlgForm"), dlg = $("#dlg");
  f.innerHTML = `<h2>Receive payment – ${esc(a.name)}</h2><p style="margin-top:0">Balance now <b>KES ${kes(a.balance)}</b>. This reduces the account balance. It is counted as money received on the day you enter it.</p><div class="grid">
    <label>Amount received (KES)<input name="amount" type="number" min="1" step="any" value="${Math.max(Math.floor(a.balance), 0) || ""}" required></label><label>Paid by<select name="method"><option>Cash</option><option>M-Pesa</option><option>Bank</option></select></label>
    <label>M-Pesa code / bank reference<input name="ref" autocomplete="off"></label><label>Date<input name="date" type="date" value="${iso(new Date())}"></label><label class="full">Note<input name="note" placeholder="For example: October statement"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save payment</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const el = f.elements;
    const r = await db.rpc("account_receive", { p_account: a.id, p_amount: Number(el.amount.value), p_method: el.method.value, p_ref: el.ref.value.trim().toUpperCase().replace(/\s+/g, "") || null, p_date: el.date.value || null, p_note: el.note.value.trim() || null });
    if (r.error) return toast(r.error.message); dlg.close(); toast("Payment recorded. New balance KES " + kes(r.data.balance)); route(); };
  dlg.showModal();
}
function chargeDialog(a) {
  const f = $("#dlgForm"), dlg = $("#dlg");
  f.innerHTML = `<h2>Charge to ${esc(a.name)}</h2><p style="margin-top:0">Two ways: put the unpaid balance of a repair or field job on the account, or add any other charge by hand. (Sales and printing/cyber entries go on the account when you choose <b>On account</b> as the payment method.)</p><div class="grid">
    <label class="full"><b>Repair or job number</b> (for example JC-0012 or J-004)<input name="ref" placeholder="JC-0012" autocomplete="off"></label>
    <p class="full" style="margin:0;color:var(--mut)">— or, a manual charge —</p>
    <label>Amount (KES)<input name="amount" type="number" min="1" step="any"></label><label>Date<input name="date" type="date" value="${iso(new Date())}"></label><label class="full">What it is for<input name="desc" placeholder="For example: Router configuration"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Charge</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const el = f.elements, ref = el.ref.value.trim();
    const r = ref ? await db.rpc("account_charge_ref", { p_account: a.id, p_ref: ref }) : await db.rpc("account_charge", { p_account: a.id, p_amount: Number(el.amount.value), p_description: el.desc.value, p_date: el.date.value || null });
    if (r.error) return toast(r.error.message); dlg.close(); toast(ref ? `${ref.toUpperCase()} charged: KES ${kes(r.data.amount)}` : "Charge added"); route(); };
  dlg.showModal();
}
async function statementDialog(a) {
  const now = new Date(); let from = iso(new Date(now.getFullYear(), now.getMonth(), 1)), to = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const f = $("#dlgForm"), dlg = $("#dlg");
  const load = async () => { const r = await db.rpc("account_statement", { p_account: a.id, p_from: from, p_to: to }); if (r.error) { toast(r.error.message); return null; } return r.data; };
  const draw = async () => {
    const s = await load(); if (!s) return;
    f.innerHTML = `<h2>Statement – ${esc(a.name)} <small>${esc(a.acc_no)}</small></h2><div class="bar"><label>From <input name="from" type="date" value="${from}"></label><label>To <input name="to" type="date" value="${to}"></label>
      <button class="btn sm ghost" value="month" formnovalidate>This month</button><button class="btn sm ghost" value="last" formnovalidate>Last month</button></div>
      <div class="cards"><div class="card"><small>Brought forward</small><b>${kes(s.opening)}</b></div><div class="card"><small>Charges</small><b>${kes(s.charges)}</b></div><div class="card"><small>Payments</small><b>${kes(s.payments)}</b></div><div class="card"><small>Balance due</small><b>KES ${kes(s.closing)}</b></div></div>
      <div class="wrap"><table><thead><tr><th>Date</th><th>Details</th><th>Charge</th><th>Payment</th><th>Balance</th></tr></thead><tbody>${s.lines.map(l => `<tr><td>${esc(l.date)}</td><td>${esc([l.ref, l.description, l.kind === "payment" ? (l.method || "") + (l.mpesa_ref ? " " + l.mpesa_ref : "") : ""].filter(Boolean).join(" · "))}</td>
        <td class="n">${l.amount > 0 ? kes(l.amount) : ""}</td><td class="n">${l.amount < 0 ? kes(-l.amount) : ""}</td><td class="n">${kes(l.balance)}</td></tr>`).join("") || `<tr><td colspan="5">Nothing in this period.</td></tr>`}</tbody></table></div>
      <div class="bar" style="margin-top:14px"><button class="btn" value="print" formnovalidate>Print / PDF</button>${can("accounts.edit") && a.phone ? `<button class="btn ghost" value="sms" formnovalidate>SMS balance reminder</button><button class="btn wabtn" value="wa" formnovalidate>WhatsApp</button>` : ""}<button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
    f.onsubmit = async e => { const v = e.submitter && e.submitter.value; if (v === "cancel" || !v) return; e.preventDefault();
      if (v === "month" || v === "last") { const d = new Date(), m = v === "last" ? d.getMonth() - 1 : d.getMonth(); from = iso(new Date(d.getFullYear(), m, 1)); to = iso(new Date(d.getFullYear(), m + 1, 0)); return draw(); }
      if (v === "print") return printHtml(statementHtml(s), `${a.acc_no} Statement ${s.to}.pdf`);
      if (v === "sms") { const r = await db.rpc("account_send_statements", { p_account: a.id }); return r.error ? toast(r.error.message) : toast(r.data.queued ? "SMS queued" : "Nothing owed, so no SMS was sent"); }
      if (v === "wa") { const ph = String(a.phone || "").replace(/\D/g, "").replace(/^0/, "254"); const msg = `Hello ${a.contact_person || a.name}, your ${SHOP.name} account ${a.acc_no} balance is KES ${kes(s.closing)} as at ${s.to}. Please pay by M-Pesa or at the shop. ${SHOP.phone}`; window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(msg), "_blank"); } };
    f.elements.from.onchange = e => { from = e.target.value; draw(); }; f.elements.to.onchange = e => { to = e.target.value; draw(); };
  };
  await draw(); dlg.showModal();
}
function statementHtml(s) {
  const a = s.account;
  return head("STATEMENT OF ACCOUNT", a.acc_no) + kv([["Customer", a.name], ["Contact", [a.contact_person, a.phone].filter(Boolean).join(" · ")], ["Address", a.address], ["Period", `${s.from} to ${s.to}`]]) +
    `<table style="margin-top:10px"><thead><tr><th>Date</th><th>Details</th><th>Charge (KES)</th><th>Payment (KES)</th><th>Balance (KES)</th></tr></thead><tbody>
    <tr><td></td><td><i>Balance brought forward</i></td><td></td><td></td><td>${kes(s.opening)}</td></tr>${s.lines.map(l => `<tr><td>${esc(l.date)}</td><td>${esc([l.ref, l.description, l.kind === "payment" ? (l.method || "") + (l.mpesa_ref ? " " + l.mpesa_ref : "") : ""].filter(Boolean).join(" · "))}</td>
    <td>${l.amount > 0 ? kes(l.amount) : ""}</td><td>${l.amount < 0 ? kes(-l.amount) : ""}</td><td>${kes(l.balance)}</td></tr>`).join("")}
    <tr><th colspan="2" align="right">Totals for the period</th><th>${kes(s.charges)}</th><th>${kes(s.payments)}</th><th></th></tr><tr><th colspan="4" align="right">BALANCE DUE (KES)</th><th>${kes(s.closing)}</th></tr></tbody></table>
    <p>Please pay by M-Pesa or at our shop and quote ${esc(a.acc_no)}. Questions? Call ${SHOP.phone}. Thank you for your business.</p>`;
}

// ---- live chat with website visitors ---------------------------------------------------------
let chatAway = (() => { try { return localStorage.getItem("fk_away") === "1"; } catch (_) { return false; } })();
async function chatBeat() {
  if (!me || !can("chat.use")) return;
  const r = await db.rpc("chat_heartbeat", { p_available: !chatAway }); if (r.error || !r.data) return;
  const a = document.querySelector('#nav a[data-k="chat"]'); if (!a) return;
  let b = a.querySelector(".nb"); const n = Number(r.data.waiting || 0);
  if (!b) { b = document.createElement("span"); b.className = "nb"; b.style.cssText = "margin-left:auto;background:#e5484d;color:#fff;border-radius:10px;padding:0 7px;font-size:12px;display:none"; a.appendChild(b); }
  b.textContent = n; b.style.display = n ? "" : "none";
  if (n > (window.__chatN || 0) && location.hash !== "#chat") toast("A website visitor is waiting in Live chat");
  window.__chatN = n;
}
async function chatPage() {
  let cur = null, last = 0, shown = [];
  $("#view").innerHTML = `<h2>Live chat</h2><p style="color:var(--mut);margin-top:0">Visitors on the website can chat with you while you are <b>available</b>. When nobody is available their message is saved as an enquiry instead. Stay on this page or keep the app open to be counted as online.</p>
    <div class="bar"><button class="btn" id="cav"></button><span id="cstat" style="color:var(--mut)"></span></div>
    <div style="display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:12px" id="cgrid"><div class="card" style="padding:0;max-height:62vh;overflow:auto" id="cinbox"></div>
    <div class="card" style="display:flex;flex-direction:column;height:62vh;padding:0"><div id="chead" style="padding:10px 14px;border-bottom:1px solid var(--line,#e5e7eb);min-height:44px"><span style="color:var(--mut)">Choose a chat on the left.</span></div>
    <div id="cmsgs" style="flex:1;overflow:auto;padding:12px 14px"></div><form id="cform" class="bar" style="padding:10px 14px;margin:0;border-top:1px solid var(--line,#e5e7eb)" hidden><input name="m" placeholder="Type your reply…" autocomplete="off" style="flex:1" maxlength="1000"><button class="btn">Send</button><button class="btn ghost" type="button" id="cclose"></button></form></div></div>`;
  if (innerWidth < 760) $("#cgrid").style.gridTemplateColumns = "1fr";
  const setAv = () => { $("#cav").textContent = chatAway ? "You are AWAY – tap to become available" : "You are AVAILABLE – tap to go away"; $("#cav").style.background = chatAway ? "#667085" : "#12b76a"; };
  setAv(); $("#cav").onclick = async () => { chatAway = !chatAway; try { localStorage.setItem("fk_away", chatAway ? "1" : "0"); } catch (_) {} setAv(); await chatBeat(); };
  const bubble = m => `<div style="margin:6px 0;display:flex;justify-content:${m.sender === "staff" ? "flex-end" : m.sender === "system" ? "center" : "flex-start"}"><div style="max-width:78%;padding:8px 11px;border-radius:12px;font-size:14px;${m.sender === "staff" ? "background:#0d6eae;color:#fff" : m.sender === "system" ? "background:#f2f4f7;color:#667085;font-size:12px" : "background:#eef2f6"}">${m.sender === "staff" ? `<small style="opacity:.8">${esc(m.name || "")}</small><br>` : ""}${esc(m.body)}<br><small style="opacity:.6">${esc(String(m.at).replace("T", " ").slice(11, 16))}</small></div></div>`;
  const inbox = async () => {
    const r = await db.rpc("chat_inbox"); if (r.error) return; const list = r.data || [];
    $("#cinbox").innerHTML = list.map(t => `<div data-t="${t.id}" style="padding:10px 14px;border-bottom:1px solid var(--line,#eee);cursor:pointer;${cur === t.id ? "background:#eef6fc" : ""}"><b>${esc(t.name)}</b> ${t.unread ? `<span class="tag bad">new</span>` : ""}${t.status === "Closed" ? ` <span class="tag">closed</span>` : ""}<br><small style="color:var(--mut)">${esc(t.last || "")}</small><br><small style="color:var(--mut)">${esc(String(t.last_at).replace("T", " ").slice(5, 16))}${t.assigned ? " · " + esc(t.assigned) : ""}</small></div>`).join("") || `<div class="empty" style="padding:20px">No chats yet.</div>`;
    $("#cstat").textContent = `${list.filter(t => t.status === "Open").length} open`;
  };
  const open = async (id, fresh) => {
    if (fresh) { cur = id; last = 0; shown = []; $("#cmsgs").innerHTML = ""; }
    const r = await db.rpc("chat_open", { p_id: id, p_after: last }); if (r.error) return toast(r.error.message); const d = r.data;
    if (fresh) { $("#chead").innerHTML = `<b>${esc(d.name)}</b> ${d.phone ? `· <a href="tel:${esc(d.phone)}">${esc(d.phone)}</a>` : ""} <small style="color:var(--mut)">${d.page ? "· on " + esc(d.page) : ""}</small>`; $("#cform").hidden = false; $("#cclose").textContent = d.status === "Closed" ? "Reopen" : "Close chat"; $("#cclose").dataset.s = d.status; }
    if (d.messages.length) { d.messages.forEach(m => { last = Math.max(last, m.id); }); $("#cmsgs").insertAdjacentHTML("beforeend", d.messages.map(bubble).join("")); $("#cmsgs").scrollTop = 1e9; }
  };
  $("#cinbox").onclick = async e => { const t = e.target.closest("[data-t]"); if (!t) return; await open(Number(t.dataset.t), true); inbox(); };
  $("#cform").onsubmit = async e => { e.preventDefault(); const m = e.target.m.value.trim(); if (!m || !cur) return; e.target.m.value = "";
    const r = await db.rpc("chat_reply", { p_id: cur, p_body: m }); if (r.error) return toast(r.error.message); await open(cur, false); inbox(); };
  $("#cclose").onclick = async () => { if (!cur) return; const to = $("#cclose").dataset.s === "Closed" ? "Open" : "Closed"; const r = await db.rpc("chat_set_status", { p_id: cur, p_status: to }); if (r.error) return toast(r.error.message); await open(cur, true); inbox(); };
  await inbox(); chatBeat();
  (window.__t = window.__t || []).push(setInterval(async () => { if (!document.hidden) { inbox(); if (cur) open(cur, false); } }, 4000));
}

// ---- supplier payables (what you owe suppliers) -------------------------------------------------
async function payablesPage() {
  const rows = must(await db.from("supplier_balances").select("*").order("name")) || [], edit = can("payables.edit");
  const sum = f => rows.reduce((s, r) => s + Math.max(Number(r[f]), 0), 0);
  let showAll = sessionStorage.getItem("payall") === "1";
  const draw = () => {
    const q = ($("#pq") ? $("#pq").value : "").toLowerCase(), list = rows.filter(r => (showAll || Number(r.balance) !== 0 || Number(r.billed) > 0) && (!q || (r.name + (r.phone || "") + (r.contact_person || "")).toLowerCase().includes(q)));
    $("#ptb").innerHTML = list.map(r => `<tr><td><b>${esc(r.name)}</b><br><small>${esc([r.contact_person, r.phone].filter(Boolean).join(" · "))}</small></td><td class="n">${kes(r.billed)}</td><td class="n">${kes(r.paid)}</td><td class="n"><b>${kes(r.balance)}</b></td>
      <td class="n">${Number(r.overdue) > 0 ? `<span class="tag bad">${kes(r.overdue)}</span>` : ""}</td><td class="n">${Number(r.due_7_days) > 0 ? kes(r.due_7_days) : ""}</td><td>${esc(r.last_paid || "")}</td>
      <td><button class="btn sm" data-st="${r.id}">Statement</button> ${edit ? `<button class="btn sm ghost" data-bill="${r.id}">+ Bill</button> <button class="btn sm" style="background:#12b76a" data-pay="${r.id}">Pay</button>` : ""}</td></tr>`).join("")
      || `<tr><td colspan="8"><div class="empty">${BRAND.emptyArt(130)}No supplier bills yet. Add suppliers under <a href="#suppliers">Suppliers</a>, then press “+ Bill” when stock arrives on credit.</div></td></tr>`;
  };
  $("#view").innerHTML = `<h2>Supplier payables</h2><p style="color:var(--mut);margin-top:0">What you owe suppliers. Record each supplier invoice with <b>+ Bill</b> and its due date; record each payment with <b>Pay</b>. Payments settle the oldest bills first, and every payment is also written to Expenses (Stock purchase) so End of day and the reports stay right.</p>
    <div class="cards"><div class="card"><small>You owe suppliers</small><b>KES ${kes(sum("balance"))}</b></div><div class="card"><small>Overdue</small><b style="color:#b42318">KES ${kes(sum("overdue"))}</b></div><div class="card"><small>Due within 7 days (incl. overdue)</small><b>KES ${kes(sum("due_7_days"))}</b></div><div class="card"><small>Suppliers owed</small><b>${rows.filter(r => Number(r.balance) > 0).length}</b></div></div>
    <div class="bar"><input id="pq" placeholder="Search suppliers…" style="max-width:240px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pall" ${showAll ? "checked" : ""} style="width:auto"> Show suppliers with no bills</label></div>
    <div class="wrap"><table><thead><tr><th>Supplier</th><th>Billed</th><th>Paid</th><th>Balance (KES)</th><th>Overdue</th><th>Due in 7 days</th><th>Last paid</th><th></th></tr></thead><tbody id="ptb"></tbody></table></div>`;
  draw(); $("#pq").oninput = draw; $("#pall").onchange = e => { showAll = e.target.checked; sessionStorage.setItem("payall", showAll ? "1" : "0"); draw(); };
  const by = id => rows.find(r => String(r.id) === String(id));
  $("#ptb").onclick = e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.st) supplierStatement(by(b.dataset.st)); if (b.dataset.bill) billDialog(by(b.dataset.bill)); if (b.dataset.pay) supplierPayDialog(by(b.dataset.pay)); };
}
function billDialog(s) {
  const f = $("#dlgForm"), dlg = $("#dlg"), plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  f.innerHTML = `<h2>New bill – ${esc(s.name)}</h2><div class="grid"><label>Supplier invoice no.<input name="ref" autocomplete="off"></label><label>Amount (KES)<input name="amount" type="number" min="1" step="any" required></label>
    <label>Bill date<input name="bill_date" type="date" value="${iso(new Date())}" required></label><label>Payment terms<select name="terms"><option value="0">Due on the bill date</option><option value="7">7 days</option><option value="14">14 days</option><option value="30" selected>30 days</option><option value="60">60 days</option><option value="x">Choose the due date…</option></select></label>
    <label>Due date<input name="due_date" type="date" value="${plus(30)}" required></label><label>What it is for<input name="description" placeholder="For example: 10 phone screens"></label><label class="full">Notes<input name="notes"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save bill</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  const el = f.elements, setDue = () => { const t = el.terms.value; if (t === "x") return; const d = new Date(el.bill_date.value || new Date()); d.setDate(d.getDate() + Number(t)); el.due_date.value = iso(d); };
  el.terms.onchange = setDue; el.bill_date.onchange = setDue;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    if (el.due_date.value < el.bill_date.value) return toast("The due date cannot be before the bill date.");
    const r = await db.from("supplier_bills").insert({ supplier_id: s.id, bill_date: el.bill_date.value, due_date: el.due_date.value, ref: el.ref.value.trim() || null, description: el.description.value.trim() || null, amount: Number(el.amount.value), notes: el.notes.value.trim() || null }).select("id");
    if (r.error) return toast(r.error.message); dlg.close(); toast("Bill saved"); route(); };
  dlg.showModal();
}
function supplierPayDialog(s) {
  const f = $("#dlgForm"), dlg = $("#dlg");
  f.innerHTML = `<h2>Pay ${esc(s.name)}</h2><p style="margin-top:0">You owe <b>KES ${kes(s.balance)}</b>${Number(s.overdue) > 0 ? ` (KES ${kes(s.overdue)} overdue)` : ""}. The payment is also recorded as an expense.</p><div class="grid">
    <label>Amount paid (KES)<input name="amount" type="number" min="1" step="any" value="${Math.max(Math.floor(s.balance), 0) || ""}" required></label><label>Paid by<select name="method"><option>Cash</option><option>M-Pesa</option><option>Bank</option></select></label>
    <label>M-Pesa code / bank reference<input name="ref" autocomplete="off"></label><label>Date<input name="date" type="date" value="${iso(new Date())}"></label><label class="full">Note<input name="note" placeholder="For example: INV-102"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save payment</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const el = f.elements, amt = Number(el.amount.value);
    if (amt > Number(s.balance) && !confirm(`This is more than the KES ${kes(s.balance)} you owe ${s.name}. Record it as an advance payment?`)) return;
    const r = await db.rpc("supplier_pay", { p_supplier: s.id, p_amount: amt, p_method: el.method.value, p_ref: el.ref.value.trim().toUpperCase().replace(/\s+/g, "") || null, p_date: el.date.value || null, p_note: el.note.value.trim() || null });
    if (r.error) return toast(r.error.message); dlg.close(); toast("Payment saved. You now owe KES " + kes(r.data.balance)); route(); };
  dlg.showModal();
}
async function supplierStatement(s) {
  const now = new Date(); let from = iso(new Date(now.getFullYear(), 0, 1)), to = iso(now);
  const f = $("#dlgForm"), dlg = $("#dlg");
  const draw = async () => {
    const r = await db.rpc("supplier_statement", { p_supplier: s.id, p_from: from, p_to: to }); if (r.error) return toast(r.error.message); const st = r.data;
    f.innerHTML = `<h2>Statement – ${esc(s.name)}</h2><div class="bar"><label>From <input name="from" type="date" value="${from}"></label><label>To <input name="to" type="date" value="${to}"></label><button class="btn sm ghost" value="year" formnovalidate>This year</button><button class="btn sm ghost" value="all" formnovalidate>Everything</button></div>
      <div class="cards"><div class="card"><small>Brought forward</small><b>${kes(st.opening)}</b></div><div class="card"><small>Billed</small><b>${kes(st.billed)}</b></div><div class="card"><small>Paid</small><b>${kes(st.paid)}</b></div><div class="card"><small>You owe</small><b>KES ${kes(st.closing)}</b></div></div>
      <div class="wrap"><table><thead><tr><th>Date</th><th>Details</th><th>Bill</th><th>Payment</th><th>Balance</th><th></th></tr></thead><tbody>${st.lines.map((l, i) => `<tr><td>${esc(l.date)}${l.due ? `<br><small>due ${esc(l.due)}</small>` : ""}</td><td>${esc([l.ref, l.description, l.kind === "payment" ? l.method : ""].filter(Boolean).join(" · "))}</td>
        <td class="n">${l.amount > 0 ? kes(l.amount) : ""}</td><td class="n">${l.amount < 0 ? kes(-l.amount) : ""}</td><td class="n">${kes(l.balance)}</td><td>${can("money.all") ? `<button class="btn sm warn" value="del${i}" formnovalidate title="Delete this line">×</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6">Nothing in this period.</td></tr>`}</tbody></table></div>
      <div class="bar" style="margin-top:14px"><button class="btn" value="print" formnovalidate>Print / PDF</button><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
    f.onsubmit = async e => { const v = e.submitter && e.submitter.value; if (v === "cancel" || !v) return; e.preventDefault();
      if (v === "year") { from = iso(new Date(now.getFullYear(), 0, 1)); to = iso(now); return draw(); }
      if (v === "all") { from = "2000-01-01"; to = iso(now); return draw(); }
      if (v === "print") return printHtml(supplierStatementHtml(st), `${s.name} statement ${st.to}.pdf`);
      if (v.startsWith("del")) { const l = st.lines[Number(v.slice(3))]; if (!confirm(l.kind === "payment" ? "Delete this payment? Its expense is removed too." : "Delete this bill?")) return;
        const q = await db.from(l.kind === "payment" ? "supplier_payments" : "supplier_bills").delete().eq("id", l.id); if (q.error) return toast(q.error.message); toast("Deleted"); draw(); } };
    f.elements.from.onchange = e => { from = e.target.value; draw(); }; f.elements.to.onchange = e => { to = e.target.value; draw(); };
  };
  await draw(); dlg.showModal();
}
function supplierStatementHtml(st) {
  const s = st.supplier;
  return head("SUPPLIER ACCOUNT", "") + kv([["Supplier", s.name], ["Contact", [s.contact_person, s.phone].filter(Boolean).join(" · ")], ["Period", `${st.from} to ${st.to}`]]) +
    `<table style="margin-top:10px"><thead><tr><th>Date</th><th>Details</th><th>Bill (KES)</th><th>Paid (KES)</th><th>Balance (KES)</th></tr></thead><tbody><tr><td></td><td><i>Balance brought forward</i></td><td></td><td></td><td>${kes(st.opening)}</td></tr>
    ${st.lines.map(l => `<tr><td>${esc(l.date)}</td><td>${esc([l.ref, l.description, l.kind === "payment" ? l.method : l.due ? "due " + l.due : ""].filter(Boolean).join(" · "))}</td><td>${l.amount > 0 ? kes(l.amount) : ""}</td><td>${l.amount < 0 ? kes(-l.amount) : ""}</td><td>${kes(l.balance)}</td></tr>`).join("")}
    <tr><th colspan="2" align="right">Totals</th><th>${kes(st.billed)}</th><th>${kes(st.paid)}</th><th></th></tr><tr><th colspan="4" align="right">WE OWE (KES)</th><th>${kes(st.closing)}</th></tr></tbody></table>`;
}

// ---- lists ------------------------------------------------------------------
async function listsPage() {
  await refreshLookups();
  const block = (kind, title) => `<div class="card"><b style="font-size:16px">${title}</b><div style="margin:8px 0">${lists[kind].map(x => `<span class="tag" style="margin:2px;display:inline-block">${esc(x.value)}${kind === "stock_type" ? " · " + esc(x.code) : ""}
    ${can("lists.manage") ? `<a href="#" data-rm="${x.id}">×</a>` : ""}</span>`).join("")}</div>
    <form data-kind="${kind}" class="bar"><input name="value" placeholder="Add new…" required>${kind === "stock_type" ? `<input name="code" placeholder="Code letters" maxlength="3" style="width:110px" required>` : ""}<button class="btn sm">Add</button></form></div>`;
  const svcBlock = `<div class="card" style="grid-column:1/-1"><b style="font-size:16px">Printing & Cyber price list</b><div class="wrap" style="margin:8px 0"><table><thead><tr><th>Service</th><th>Per</th><th>Price (KES)</th><th></th></tr></thead><tbody>
    ${catalog.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.unit)}</td><td><input type="number" min="0" step="any" value="${c.default_price}" data-price="${c.id}" style="width:110px"></td><td><button class="btn sm" data-sp="${c.id}">Save</button> <button class="btn sm warn" data-sd="${c.id}">Remove</button></td></tr>`).join("")}</tbody></table></div>
    <form data-svcadd class="bar"><input name="name" placeholder="New service" required><input name="unit" placeholder="Per (page, each…)" style="width:150px"><input name="price" type="number" min="0" step="any" placeholder="Price" style="width:110px" required><button class="btn sm">Add service</button></form></div>`;
  $("#view").innerHTML = `<h2>Lists</h2><p style="color:var(--mut)">These feed the dropdowns. Add new entries any time.</p><div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    ${block("item_type", "Item types (Repairs)")}${block("brand", "Brand / model (Repairs)")}${block("stock_type", "Stock types (Inventory) and code letters")}${svcBlock}</div>`;
  $("#view").onsubmit = async e => { e.preventDefault(); const f = e.target;
    if (f.dataset.svcadd !== undefined) { const r = await db.from("service_catalog").insert({ name: f.name.value.trim(), unit: f.unit.value.trim() || "each", default_price: Number(f.price.value) }); return r.error ? toast(r.error.message) : listsPage(); }
    const row = { kind: f.dataset.kind, value: f.value.value.trim() }; if (f.code) row.code = f.code.value.trim().toUpperCase();
    const r = await db.from("list_items").insert(row); if (r.error) toast(r.error.message); else listsPage(); };
  $("#view").onclick = async e => {
    const sp = e.target.closest("[data-sp]"); if (sp) { const r = await db.from("service_catalog").update({ default_price: Number($(`[data-price="${sp.dataset.sp}"]`).value) }).eq("id", Number(sp.dataset.sp)); return r.error ? toast(r.error.message) : toast("Price saved"); }
    const sd = e.target.closest("[data-sd]"); if (sd) { if (!confirm("Remove this service from the price list?")) return; const r = await db.from("service_catalog").update({ active: false }).eq("id", Number(sd.dataset.sd)); return r.error ? toast(r.error.message) : listsPage(); }
    const a = e.target.closest("[data-rm]"); if (!a) return; e.preventDefault(); const r = await db.from("list_items").delete().eq("id", Number(a.dataset.rm)); if (r.error) toast(r.error.message); else listsPage(); };
}

// ---- documents (quotation / invoice / receipt) --------------------------------
// ---- documents: Draft -> Issued -> Void; quotations, invoices, receipts, delivery notes, credit notes ------------------
let all_docs_cache = [];
let COMPANY = { vat_registered: false, vat_rate: 16, etims_registered: true };
async function loadCompany() {
  const r = await db.from("company_settings").select("*"); if (r.error || !r.data) return COMPANY;
  const m = Object.fromEntries(r.data.map(x => [x.key, x.value]));
  COMPANY = { vat_registered: m.vat_registered === "true", vat_rate: Number(m.vat_rate || 16), etims_registered: m.etims_registered !== "false" };
  return COMPANY;
}
const DOC_PFX = { Quotation: "QT", Invoice: "INV", Receipt: "RCT", "Delivery note": "DN", "Credit note": "CN" };
const docNo = r => r.doc_no || ((DOC_PFX[r.doc_type] || "DOC") + "-" + String(r.id).padStart(4, "0"));
const docSt = r => r.status || "Draft";
const isImp = r => r.origin === "import";
function docTotals(d) {
  const items = d.items || [], sub = items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0), disc = Number(d.discount || 0);
  if (d.stated_total != null && d.stated_total !== "") { const t = Number(d.stated_total); return { sub, vat: 0, total: t, balance: t - Number(d.paid_before || 0), stated: true, lines: sub - disc }; }
  const vat = (sub - disc) * Number(d.vat_rate || 0) / 100, total = sub - disc + vat;
  return { sub, vat, total, balance: total - Number(d.paid_before || 0) };
}
const EV_LABEL = { issued: "Issued", revised: "Revised", etims: "eTIMS number", voided: "Voided", cancelled: "Cancelled with credit note", converted: "Converted to invoice", quote_sent: "Quotation marked open", quote_accepted: "Quotation accepted", quote_lost: "Quotation lost", quote_expired: "Quotation expired", delivery_note: "Delivery note made", created: "Created" };
async function docsPage() {
  await Promise.all([loadCompany(), refreshLookups()]);
  const all = (must(await db.from("documents").select("*").order("id", { ascending: false }).limit(2000)) || []).sort((a, b) => String(b.doc_date || "").localeCompare(String(a.doc_date || "")) || b.id - a.id);
  all_docs_cache = all;
  const bal = await invBalances();
  const flt = { type: "", st: "", q: "" };
  const stTag = r => { const s = docSt(r); return `<span class="tag ${s === "Void" ? "bad" : s === "Draft" ? "draft" : "ok"}">${s}</span>${isImp(r) ? ` <span class="tag imp">Imported</span>` : ""}${qTag(r)}${r.doc_type === "Invoice" && s === "Issued" ? " " + ivTag(bal[r.id]) : ""}`; };
  const etTag = r => ["Invoice", "Credit note"].includes(r.doc_type) && docSt(r) === "Issued" ? (r.etims_no ? `<small>${esc(r.etims_no)}</small>` : (COMPANY.etims_registered && !isImp(r) ? `<span class="tag bad">eTIMS missing</span>` : "")) : "";
  let view = [];
  const btns = (r, i) => {
    const st = docSt(r), b = [], v19 = "status" in r;
    if (!isImp(r) && st === "Draft") {
      if (can("docs.edit")) b.push(`<button class="btn sm" data-e="${i}">Edit</button>`);
      if (v19 && can("docs.issue")) b.push(`<button class="btn sm" style="background:#12b76a" data-iss="${i}">Issue</button>`);
    }
    const bl = r.doc_type === "Invoice" && st === "Issued" ? bal[r.id] : null;
    if (bl && Number(bl.balance) > 0.005 && can(r.account_id ? "accounts.edit" : "income.add")) b.push(`<button class="btn sm" style="background:#12b76a" data-pay="${i}">Record payment</button>`);
    if (bl && Number(bl.paid) > 0) b.push(`<button class="btn sm ghost" data-pl="${i}">Payments</button>`);
    b.push(`<button class="btn sm pbtn" data-p="${i}">Print</button>`);
    if (isImp(r) && st === "Issued" && can("docs.issue") && r.doc_type === "Invoice") b.push(`<button class="btn sm ghost" data-et="${i}">eTIMS no.</button>`);
    if (!isImp(r) && st === "Issued") {
      if (can("docs.issue") && r.doc_type !== "Credit note") b.push(`<button class="btn sm ghost" data-rev="${i}">Revise</button>`);
      if (can("docs.issue") && ["Invoice", "Credit note"].includes(r.doc_type)) b.push(`<button class="btn sm ghost" data-et="${i}">eTIMS no.</button>`);
      if (r.doc_type === "Invoice" && can("docs.add")) b.push(`<button class="btn sm ghost" data-dn="${i}">Delivery note</button>`);
      if (r.doc_type === "Invoice" && can("docs.void")) b.push(`<button class="btn sm warn" data-cx="${i}">Cancel with credit note</button>`);
      else if (can("docs.void") && !["Invoice", "Credit note"].includes(r.doc_type)) b.push(`<button class="btn sm warn" data-vd="${i}">Void</button>`);
    }
    if (r.doc_type === "Quotation" && st === "Issued" && can("docs.issue") && (r.quote_state || isImp(r))) b.push(`<button class="btn sm ghost" data-qs="${i}">Quote status</button>`);
    if (["Quotation", "Invoice"].includes(r.doc_type) && !isImp(r) && st !== "Void" && can("costs.view")) b.push(`<button class="btn sm ghost" data-mg="${i}">Margin</button>`);
    if (r.doc_type === "Quotation" && st !== "Void" && v19 && can("docs.add")) b.push(`<button class="btn sm ghost" data-cv="${i}">Convert to invoice</button>`);
    if (v19) b.push(`<button class="btn sm ghost" data-h="${i}">History</button>`);
    if (!isImp(r) && st === "Draft" && can("docs.delete")) b.push(`<button class="btn sm warn" data-d="${i}">Delete</button>`);
    return b.join(" ");
  };
  const draw = () => {
    const q = flt.q.toLowerCase();
    view = all.filter(r => (!flt.type || r.doc_type === flt.type) && (!flt.st || (flt.st === "Imported" ? isImp(r) : flt.st === "Unpaid" ? !!bal[r.id] && bal[r.id].status !== "Paid" && !isImp(r) : docSt(r) === flt.st)) && (!q || [docNo(r), r.customer, r.lpo_no, r.reference, r.etims_no, r.project].join(" ").toLowerCase().includes(q)));
    $("#tb").innerHTML = view.slice(0, 300).map((r, i) => `<tr class="${docSt(r) === "Void" ? "low" : ""}"><td><b>${esc(docNo(r))}</b>${(r.revision || 1) > 1 ? ` <small>rev ${r.revision}</small>` : ""}</td><td>${esc(r.doc_type)}</td><td>${stTag(r)}</td><td>${esc(r.doc_date || "—")}</td><td>${esc(r.customer)}${r.lpo_no ? `<br><small>LPO ${esc(r.lpo_no)}</small>` : ""}</td>
      <td class="n">${["Delivery note"].includes(r.doc_type) ? "" : kes(docTotals(r).total)}</td><td>${etTag(r)}</td><td class="acts">${btns(r, i)}</td></tr>`).join("") || `<tr><td colspan="8">No documents match.</td></tr>`;
    $("#cnt").textContent = view.length > 300 ? `Showing 300 of ${view.length}. Use the search to narrow it.` : `${view.length} document(s)`;
  };
  $("#view").innerHTML = `<h2>Quotations · Invoices · Receipts · Delivery notes</h2>
    <div class="bar">${can("docs.add") ? `<button class="btn" id="nd">+ New document</button>` : ""}${can("settings.manage") ? `<button class="btn ghost" id="tax">Tax settings</button>` : ""}${me.role === "owner" ? `<button class="btn ghost" id="imp">Import history</button>` : ""}
      <select id="ft"><option value="">All types</option>${["Quotation", "Invoice", "Receipt", "Delivery note", "Credit note"].map(x => `<option>${x}</option>`).join("")}</select>
      <select id="fs"><option value="">All statuses</option>${["Draft", "Issued", "Unpaid", "Void", "Imported"].map(x => `<option>${x}</option>`).join("")}</select>
      <input id="fq" placeholder="Search number, customer, LPO, eTIMS…" style="max-width:280px"><span id="cnt" style="color:var(--mut)"></span></div>
    <p style="color:var(--mut);margin:0 0 8px">${COMPANY.vat_registered ? `VAT is on (${COMPANY.vat_rate}%).` : "Not VAT-registered: no VAT line is shown or printed."} Only <b>drafts</b> can be edited or deleted. An issued invoice is <b>revised</b> (same number, history kept) or <b>cancelled with a credit note</b>.</p>
    <div class="wrap"><table><thead><tr><th>No.</th><th>Type</th><th>Status</th><th>Date</th><th>Customer</th><th>Total</th><th>eTIMS</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  draw();
  if ($("#nd")) $("#nd").onclick = () => docForm();
  if ($("#tax")) $("#tax").onclick = taxDialog;
  if ($("#imp")) $("#imp").onclick = importDialog;
  $("#ft").onchange = e => { flt.type = e.target.value; draw(); }; $("#fs").onchange = e => { flt.st = e.target.value; draw(); }; $("#fq").oninput = e => { flt.q = e.target.value; draw(); };
  const rpc = async (fn, args, ok) => { const r = await db.rpc(fn, args); if (r.error) { toast(r.error.message); return null; } if (ok) toast(ok(r.data)); return r.data; };
  $("#tb").onclick = async e => {
    const b = e.target.closest("button"); if (!b) return; const D = b.dataset, row = k => view[D[k]];
    if (D.e) { const r = row("e"); r.doc_type === "Delivery note" ? dnForm(r) : docForm(r); }
    else if (D.p) printCard("document", row("p"));
    else if (D.pay) invPayDialog(bal[row("pay").id], docsPage);
    else if (D.pl) invPaymentsDialog(bal[row("pl").id], docsPage);
    else if (D.iss) { const r = row("iss"); if (!confirm(`Issue ${docNo(r)}? Once issued it cannot be edited or deleted: it can only be revised or cancelled.`)) return; if (await rpc("doc_issue", { p_id: r.id }, x => "Issued " + x.doc_no + (r.doc_type === "Invoice" ? ". Add its eTIMS number when you have it." : ""))) docsPage(); }
    else if (D.rev) docForm(row("rev"), { revise: true });
    else if (D.et) etimsDialog(row("et"));
    else if (D.qs) quoteDialog(row("qs"), docsPage);
    else if (D.mg) marginDialog("document", row("mg"));
    else if (D.dn) { const r = row("dn"); const x = await rpc("doc_delivery_note", { p_invoice: r.id }); if (x) { await docsPage(); const nd = (await db.from("documents").select("*").eq("id", x.id)).data; dnForm(Array.isArray(nd) ? nd[0] : nd); } }
    else if (D.cx) reasonDialog(row("cx"), "Cancel invoice with a credit note", "This issues a credit note for the whole invoice and marks the invoice void. If it was charged to a credit account the balance is reversed. This cannot be undone.", "doc_cancel_invoice", "Cancel invoice", x => "Credit note " + x.credit_note + " issued");
    else if (D.vd) reasonDialog(row("vd"), "Void document", "A voided document stays on record but no longer counts.", "doc_void", "Void it", () => "Voided");
    else if (D.cv) { const r = row("cv"); const x = await rpc("doc_convert_quote", { p_id: r.id }); if (x) { toast("Draft invoice " + x.doc_no + " created"); await docsPage(); const nd = (await db.from("documents").select("*").eq("id", x.id)).data; docForm(Array.isArray(nd) ? nd[0] : nd); } }
    else if (D.h) historyDialog(row("h"));
    else if (D.d && confirm("Delete this draft? This cannot be undone.")) { const r = await db.from("documents").delete().eq("id", row("d").id); if (r.error) toast(r.error.message); else docsPage(); }
  };
}
function reasonDialog(r, title, text, fn, label, msg) {
  const f = $("#dlgForm");
  f.innerHTML = `<h2>${esc(title)} – ${esc(docNo(r))}</h2><p style="margin-top:0">${esc(text)}</p><label class="full">Reason (kept in the history)<input name="why" required maxlength="200" autocomplete="off"></label>
    <div class="bar" style="margin-top:14px"><button class="btn warn" value="go">${esc(label)}</button><button class="btn ghost" value="cancel" formnovalidate>Back</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "go") return; e.preventDefault();
    const args = fn === "doc_void" || fn === "doc_cancel_invoice" ? { p_id: r.id, p_reason: f.elements.why.value.trim() } : {};
    const x = await db.rpc(fn, args); if (x.error) return toast(x.error.message); $("#dlg").close(); toast(msg(x.data)); docsPage(); };
  $("#dlg").showModal();
}
function etimsDialog(r) {
  const f = $("#dlgForm");
  f.innerHTML = `<h2>eTIMS number – ${esc(docNo(r))}</h2><p style="margin-top:0">Type the invoice number that KRA eTIMS gave this ${esc(r.doc_type.toLowerCase())}. It is printed on the PDF.</p><div class="grid">
    <label>eTIMS invoice number<input name="no" value="${esc(r.etims_no || "")}" maxlength="60" autocomplete="off"></label><label>eTIMS date (optional)<input name="dt" type="date" value="${esc(r.etims_date || iso(new Date()))}"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button>${r.etims_no ? `<button class="btn ghost" value="clear" formnovalidate>Clear</button>` : ""}<button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { const v = e.submitter.value; if (v !== "save" && v !== "clear") return; e.preventDefault();
    const x = await db.rpc("doc_set_etims", { p_id: r.id, p_no: v === "clear" ? null : f.elements.no.value.trim() || null, p_date: v === "clear" ? null : f.elements.dt.value || null });
    if (x.error) return toast(x.error.message); $("#dlg").close(); toast("Saved"); docsPage(); };
  $("#dlg").showModal();
}
async function historyDialog(r) {
  const ev = (await db.from("document_events").select("*").eq("doc_id", r.id).order("id", { ascending: true })).data || [];
  let names = {}; const pr = await db.from("profiles").select("id,full_name"); if (!pr.error && pr.data) pr.data.forEach(p => names[p.id] = p.full_name);
  const f = $("#dlgForm");
  f.innerHTML = `<h2>History – ${esc(docNo(r))}</h2>${isImp(r) ? `<p>Imported from your old files${r.history_id ? ` (${esc(r.history_id)})` : ""}. ${r.business_line ? "Business line: " + esc(r.business_line) + ". " : ""}${r.source_files ? "Source: " + esc(r.source_files) + "." : ""}</p>${r.import_flags ? `<p class="box"><b>Notes from the import:</b> ${esc(r.import_flags)}</p>` : ""}` : ""}
    ${r.source_doc_id ? `<p>Linked to document no. ${esc(String((all_docs_cache.find(x => x.id === r.source_doc_id) || {}).doc_no || r.source_doc_id))}.</p>` : ""}
    <table><thead><tr><th>When</th><th>What</th><th>Who</th><th>Note</th></tr></thead><tbody>${ev.map((e, i) => `<tr><td>${esc(String(e.at || "").replace("T", " ").slice(0, 16))}</td><td>${esc(EV_LABEL[e.event] || e.event)}</td><td>${esc(names[e.by_user] || "staff")}</td><td>${esc(e.note || "")}${e.snapshot ? ` <button type="button" class="btn sm ghost" data-ps="${i}">Print old version</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="4">No history recorded.</td></tr>`}</tbody></table>
    <div class="bar" style="margin-top:14px"><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
  f.onclick = e => { const b = e.target.closest("[data-ps]"); if (b) printCard("document", { ...ev[b.dataset.ps].snapshot, _old: true }); };
  f.onsubmit = null; $("#dlg").showModal();
}
async function docForm(row, opts = {}) {
  await Promise.all([loadCompany(), refreshLookups()]);
  const revise = !!opts.revise, blank = () => ({ desc: "", qty: 1, price: 0 });
  const d = row ? { ...row, items: (row.items || []).map(x => ({ ...x })) } : { doc_type: opts.type || "Quotation", doc_date: iso(new Date()), items: [blank()], discount: 0, paid_before: 0 };
  if (!d.items.length) d.items.push(blank());
  const f = $("#dlgForm"), v19 = !row || "status" in row, rate = () => revise ? Number(d.vat_rate || 0) : (COMPANY.vat_registered ? COMPANY.vat_rate : 0);
  const accts = accounts.filter(a => a.active || a.id === d.account_id);
  const hints = {}, hintTxt = h => h && h.found ? `Last charged KES ${kes(h.last)} (${h.last_date || "earlier"}${h.last_customer ? ", " + h.last_customer : ""}) · lowest ${kes(h.low)} · highest ${kes(h.high)} · seen ${h.times}×` : "";
  const showHint = i => { const el = f.querySelector(`[data-ph="${i}"]`), q = String((d.items[i] || {}).desc || "").trim(); if (el) el.textContent = hintTxt(hints[q]); };
  let ht; const lookup = (i, wait) => { clearTimeout(ht); ht = setTimeout(async () => { const q = String((d.items[i] || {}).desc || "").trim(); if (q.length < 3) return showHint(i);
    if (!(q in hints)) { const r = await db.rpc("price_lookup", { p_desc: q }); hints[q] = r.error ? null : r.data; } showHint(i);
    const sg = await db.rpc("price_suggest", { p_q: q }), dl = f.querySelector("#dl_items"); if (dl && !sg.error) dl.innerHTML = (sg.data || []).map(n => `<option value="${esc(n)}">`).join(""); }, wait); };
  const draw = () => {
    const inv = d.doc_type === "Invoice";
    f.innerHTML = `<h2>${revise ? "Revise " + esc(docNo(row)) + " (revision " + ((row.revision || 1) + 1) + ")" : row ? "Edit draft " + esc(docNo(row)) : "New document"}</h2>${revise ? `<p style="margin-top:0">The number stays the same. The earlier version is kept in the history.</p>` : ""}<div class="grid">
      <label>Type${revise ? `<input value="${esc(d.doc_type)}" disabled>` : `<select name="doc_type">${["Quotation", "Invoice", "Receipt"].map(x => `<option ${x === d.doc_type ? "selected" : ""}>${x}</option>`).join("")}</select>`}</label>
      <label>Date<input name="doc_date" type="date" value="${esc(d.doc_date || "")}"></label>
      ${d.doc_type === "Quotation" ? `<label>Valid until<input name="valid_until" type="date" value="${esc(d.valid_until || plusDays(d.doc_date, 30))}"></label>` : ""}
      ${inv && !revise && accts.length ? `<label class="full">Charge to a credit account (optional: puts the balance on the customer's monthly account when issued)<select name="account_id"><option value="">— not on account —</option>${accts.map(a => `<option value="${a.id}" ${String(a.id) === String(d.account_id) ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>` : ""}
      <label>Customer<input name="customer" value="${esc(d.customer)}" required></label><label>Customer KRA PIN<input name="customer_pin" value="${esc(d.customer_pin || "")}" maxlength="11" placeholder="e.g. P051234567Z" autocomplete="off"></label>
      <label>Contact<input name="contact" value="${esc(d.contact)}"></label><label>Client LPO / PO number<input name="lpo_no" value="${esc(d.lpo_no || "")}" placeholder="e.g. P-ORD_17448" autocomplete="off"></label>
      <label class="full">Address / site<input name="address" value="${esc(d.address)}"></label><label class="full">Reference (job no., project…)<input name="reference" value="${esc(d.reference)}"></label>
      <label>Discount (KES)<input name="discount" type="number" min="0" step="any" value="${d.discount || 0}"></label>
      ${d.doc_type !== "Quotation" ? `<label>Already paid (KES)<input name="paid_before" type="number" min="0" step="any" value="${d.paid_before || 0}"></label>` : ""}</div>
      ${inv && !revise ? `<p style="color:var(--mut);margin:6px 0 0">The eTIMS invoice number is added after you issue the invoice (button “eTIMS no.” in the list).</p>` : ""}
      <h3>Items</h3>${d.items.map((it, i) => `<div class="grid" style="grid-template-columns:3fr 1fr 1fr auto;margin-bottom:6px"><input data-i="${i}" data-f="desc" list="dl_items" value="${esc(it.desc)}" placeholder="Description" autocomplete="off"><input data-i="${i}" data-f="qty" type="number" min="0" step="any" value="${it.qty}"><input data-i="${i}" data-f="price" type="number" min="0" step="any" value="${it.price}"><button type="button" class="btn sm ghost" data-rm="${i}" title="Remove this line">✕</button><div data-ph="${i}" style="grid-column:1/-1;font-size:12px;color:var(--mut)"></div></div>`).join("")}<datalist id="dl_items"></datalist>
      <button type="button" class="btn sm ghost" id="addl">+ line</button> <b id="tot" style="margin-left:12px"></b>
      ${revise ? `<label class="full" style="margin-top:10px">Why are you revising it? (kept in the history)<input name="why" required maxlength="200" autocomplete="off"></label>` : ""}
      <div class="bar" style="margin-top:14px">${revise ? `<button class="btn" value="revise">Save revision</button>` : `<button class="btn" value="save">${v19 ? "Save draft" : "Save"}</button>${v19 && can("docs.issue") ? `<button class="btn" style="background:#12b76a" value="issue">Save and issue</button>` : ""}`}<button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
    sync(); d.items.forEach((_, i) => { showHint(i); if (String(d.items[i].desc || "").trim().length >= 3) lookup(i, 60); });
  };
  const collect = () => {
    for (const k of ["doc_type", "doc_date", "valid_until", "customer", "customer_pin", "contact", "lpo_no", "address", "reference"]) if (f.elements[k]) d[k] = f.elements[k].value.trim() || null;
    for (const k of ["discount", "paid_before"]) if (f.elements[k]) d[k] = Number(f.elements[k].value) || 0;
    if (f.elements.account_id) d.account_id = f.elements.account_id.value ? Number(f.elements.account_id.value) : null;
    f.querySelectorAll("[data-f]").forEach(el => d.items[el.dataset.i][el.dataset.f] = el.dataset.f === "desc" ? el.value : Number(el.value) || 0);
  };
  const sync = () => { const t = docTotals({ ...d, vat_rate: rate() }); $("#tot").textContent = (rate() > 0 ? `Subtotal ${kes(t.sub - Number(d.discount || 0))} + VAT ${rate()}% ${kes(t.vat)} = ` : "") + "Total KES " + kes(t.total); };
  f.oninput = e => { if (!$("#tot")) return; if (e.target.name === "doc_type") { collect(); draw(); return; } collect(); sync(); if (e.target.dataset.f === "desc") lookup(e.target.dataset.i, 350); };
  f.onchange = e => { if (!$("#tot")) return; if (e.target.name === "account_id") { const a = accounts.find(x => String(x.id) === e.target.value); collect(); if (a) { d.customer = a.name; d.customer_pin = a.kra_pin || d.customer_pin; draw(); } } };
  f.onclick = e => { if (!$("#tot")) return; if (e.target.id === "addl") { collect(); d.items.push(blank()); draw(); } if (e.target.dataset.rm) { collect(); d.items.splice(e.target.dataset.rm, 1); if (!d.items.length) d.items.push(blank()); draw(); } };
  f.onsubmit = async e => {
    const act = e.submitter.value; if (!["save", "issue", "revise"].includes(act)) return; e.preventDefault(); collect();
    if (!d.customer) return toast("Add the customer.");
    if (d.customer_pin && !/^[A-Za-z][0-9]{9}[A-Za-z]$/.test(d.customer_pin)) return toast("A KRA PIN looks like P051234567Z: a letter, 9 digits and a letter.");
    const items = d.items.filter(i => String(i.desc || "").trim()).map(i => ({ desc: String(i.desc).trim(), qty: Number(i.qty) || 0, price: Number(i.price) || 0 }));
    if (revise) {
      const why = f.elements.why.value.trim(); if (!why) return toast("Say why you are revising it.");
      const x = await db.rpc("doc_revise", { p_id: row.id, p_patch: { doc_date: d.doc_date, ...(d.doc_type === "Quotation" ? { valid_until: d.valid_until } : {}), customer: d.customer, customer_pin: d.customer_pin, contact: d.contact, lpo_no: d.lpo_no, address: d.address, reference: d.reference, discount: d.discount, paid_before: d.paid_before || 0, items }, p_note: why });
      if (x.error) return toast(x.error.message); $("#dlg").close(); toast("Saved as revision " + x.data.revision); return docsPage();
    }
    if (act === "issue" && !items.length) return toast("Add at least one item first.");
    const payload = { doc_type: d.doc_type, doc_date: d.doc_date, valid_until: d.doc_type === "Quotation" ? d.valid_until || null : null, customer: d.customer, customer_pin: d.customer_pin, contact: d.contact, lpo_no: d.lpo_no, address: d.address, reference: d.reference,
      discount: d.discount || 0, paid_before: d.doc_type === "Quotation" ? 0 : d.paid_before || 0, items: act === "issue" ? items : d.items, account_id: d.doc_type === "Invoice" ? d.account_id || null : null };
    if (!payload.doc_date) delete payload.doc_date;
    const r = row ? await db.from("documents").update(payload).eq("id", row.id).select("id") : await db.from("documents").insert(payload).select("id");
    if (r.error) return toast(r.error.message);
    const id = row ? row.id : (Array.isArray(r.data) ? r.data[0]?.id : r.data?.id);
    if (act === "issue" && id) { const x = await db.rpc("doc_issue", { p_id: id }); if (x.error) { $("#dlg").close(); toast("Saved as a draft, but not issued: " + x.error.message); return docsPage(); }
      $("#dlg").close(); toast("Issued " + x.data.doc_no + (d.doc_type === "Invoice" ? ". Add its eTIMS number when you have it." : "")); return docsPage(); }
    $("#dlg").close(); toast("Saved as a draft"); docsPage();
  };
  draw(); $("#dlg").showModal();
}
function dnForm(row) {
  const d = { ...row, items: (row.items || []).map(x => ({ ...x })) }, f = $("#dlgForm");
  const left = it => Number(it.ordered || 0) - Number(it.prior || 0) - Number(it.delivered || 0);
  f.innerHTML = `<h2>Delivery note ${esc(docNo(row))}</h2><p style="margin-top:0">${esc(row.reference || "")}${row.lpo_no ? " · LPO " + esc(row.lpo_no) : ""}. Enter what you are delivering now; Outstanding is worked out for you.</p>
    <table><thead><tr><th>Item</th><th>Ordered</th><th>Delivered before</th><th>Delivering now</th><th>Outstanding</th></tr></thead><tbody>${d.items.map((it, i) => `<tr><td>${esc(it.desc)}</td><td class="n">${it.ordered}</td><td class="n">${it.prior}</td><td><input data-i="${i}" type="number" min="0" max="${Number(it.ordered) - Number(it.prior)}" step="any" value="${it.delivered}" style="width:90px"></td><td class="n" id="o${i}">${left(it)}</td></tr>`).join("")}</tbody></table>
    <label class="full" style="margin-top:10px">Delivery address / site<input name="address" value="${esc(row.address || "")}"></label>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save draft</button>${can("docs.issue") ? `<button class="btn" style="background:#12b76a" value="issue">Save and issue</button>` : ""}<button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.oninput = e => { const i = e.target.dataset.i; if (i == null) return; d.items[i].delivered = Number(e.target.value) || 0; $("#o" + i).textContent = left(d.items[i]); };
  f.onclick = null; f.onchange = null;
  f.onsubmit = async e => { const act = e.submitter.value; if (!["save", "issue"].includes(act)) return; e.preventDefault();
    const r = await db.from("documents").update({ items: d.items, address: f.elements.address.value.trim() || null }).eq("id", row.id).select("id"); if (r.error) return toast(r.error.message);
    if (act === "issue") { const x = await db.rpc("doc_issue", { p_id: row.id }); if (x.error) { toast("Saved as a draft, but not issued: " + x.error.message); return; } toast("Issued " + x.data.doc_no); }
    else toast("Saved as a draft");
    $("#dlg").close(); docsPage(); };
  $("#dlg").showModal();
}
function taxDialog() {
  const f = $("#dlgForm");
  f.innerHTML = `<h2>Tax settings</h2><div class="grid">
    <label style="display:flex;gap:8px;align-items:center" class="full"><input type="checkbox" name="vat" ${COMPANY.vat_registered ? "checked" : ""} style="width:auto"> The company is registered for VAT (show a VAT line on documents)</label>
    <label>VAT rate (%)<input name="rate" type="number" min="0" max="30" step="any" value="${COMPANY.vat_rate}"></label>
    <label style="display:flex;gap:8px;align-items:center" class="full"><input type="checkbox" name="et" ${COMPANY.etims_registered ? "checked" : ""} style="width:auto"> Registered on KRA eTIMS (flag issued invoices that have no eTIMS number)</label></div>
    <p style="color:var(--mut)">Franksomi Solution Ltd is not VAT-registered, so leave VAT off. When it is off no VAT line appears on screen, PDF or print. Documents already issued keep the setting they were issued with.</p>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const el = f.elements;
    for (const [k, v] of [["vat_registered", String(el.vat.checked)], ["vat_rate", String(Number(el.rate.value) || 0)], ["etims_registered", String(el.et.checked)]]) { const r = await db.rpc("company_setting_set", { p_key: k, p_value: v }); if (r.error) return toast(r.error.message); }
    $("#dlg").close(); toast("Saved"); docsPage(); };
  $("#dlg").showModal();
}

// ---- owner-only import of the history workbook --------------------------------------------------------------------
function historyPayload(sheets) {
  const tbl = (name, key) => {
    const rows = sheets[name] || [], hi = rows.findIndex(r => r.includes(key)); if (hi < 0) throw new Error(`The sheet “${name}” is missing or has a different layout (no “${key}” column).`);
    const h = rows[hi]; return rows.slice(hi + 1).filter(r => r.some(x => x != null && x !== "")).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? null])));
  };
  const docs = tbl("Documents", "History ID"), lines = tbl("Line Items", "History ID"), clients = tbl("Clients", "Client"), prices = tbl("Price List", "Item key");
  const by = {}; lines.forEach(l => (by[l["History ID"]] ||= []).push({ desc: String(l["Description"] || "").trim(), qty: Number(l["Qty"]) || 1, price: Number(l["Unit price (KES)"]) || 0 }));
  const str = v => v == null || v === "" ? null : String(v).trim();
  const out = {
    docs: docs.filter(r => str(r["History ID"])).map(r => ({ history_id: str(r["History ID"]), original_no: str(r["Original No."]) === "0" ? null : str(r["Original No."]), kind: str(r["Kind"]), date: str(r["Date"]), client: str(r["Client"]) || "Unknown",
      project: str(r["Project / work"]), business_line: str(r["Main business line"]), total: r["Total (KES)"] == null || r["Total (KES)"] === "" ? null : Number(r["Total (KES)"]), status: str(r["Status"]), flags: str(r["Flags to check"]), files: str(r["Source file(s)"]), lines: by[str(r["History ID"])] || [] })),
    clients: clients.filter(r => str(r["Client"])).map(r => ({ name: str(r["Client"]), sector: str(r["Sector"]), contact: str(r["Known contact"]), phone: str(r["Phone"]), email: str(r["Email"]), pin: str(r["KRA PIN"]) })),
    prices: prices.filter(r => str(r["Item key"])).map(r => ({ item_key: str(r["Item key"]), item: str(r["Item (latest wording)"]), business_line: str(r["Business line"]), times: Number(r["Times quoted/billed"]) || null, low: r["Lowest price (KES)"], high: r["Highest price (KES)"], last_price: r["Last price charged (KES)"], last_used: str(r["Last used"]) })),
  };
  const nos = {}; out.docs.forEach(d => { if (d.original_no) nos[d.original_no] = (nos[d.original_no] || 0) + 1; });
  out.stats = { docs: out.docs.length, lines: lines.length, clients: out.clients.length, prices: out.prices.length, void: out.docs.filter(d => ["Possible duplicate", "Superseded"].includes(d.status)).length,
    undated: out.docs.filter(d => !d.date).length, unnumbered: out.docs.filter(d => !d.original_no).length, repeated: Object.values(nos).filter(n => n > 1).length,
    byKind: out.docs.reduce((a, d) => (a[d.kind] = (a[d.kind] || 0) + 1, a), {}), noLines: out.docs.filter(d => !d.lines.length).length };
  return out;
}
function importDialog() {
  const f = $("#dlgForm"); let payload = null;
  f.innerHTML = `<h2>Import history</h2><p style="margin-top:0">Choose the <b>Franksomi_History_Import.xlsx</b> workbook (sheets Documents, Line Items, Clients, Price List). Past quotations, invoices and delivery notes come in as <b>read-only “Imported”</b> records with their original numbers and dates. Duplicates and superseded drafts come in as <b>Void</b>. Nothing is added to customer balances or income, and nothing is sent to anyone. You can run it again safely: records already imported are skipped.</p>
    <input type="file" id="xf" accept=".xlsx"><div id="xp" style="margin:10px 0"></div>
    <div class="bar"><button class="btn" value="go" id="xgo" disabled>Import now</button><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
  f.onchange = async e => { if (e.target.id !== "xf" || !e.target.files[0]) return; const p = $("#xp"); p.textContent = "Reading the workbook…"; $("#xgo").disabled = true;
    try { payload = historyPayload(await XLSXMini.read(await e.target.files[0].arrayBuffer())); const s = payload.stats;
      p.innerHTML = `<div class="box"><b>${s.docs}</b> documents (${Object.entries(s.byKind).map(([k, n]) => n + " " + esc(k.toLowerCase())).join(", ")}) with <b>${s.lines}</b> line items<br><b>${s.void}</b> will be Void (possible duplicate / superseded) · <b>${s.undated}</b> undated · <b>${s.unnumbered}</b> unnumbered (they get their History ID) · <b>${s.noLines}</b> with no line items (the stated total is kept)<br>${s.repeated} original number(s) are used more than once in your old files. They are kept as they are.<br><b>${s.clients}</b> clients (institutions become credit accounts; individuals stay as names on their documents) · <b>${s.prices}</b> items in the price list</div>`;
      $("#xgo").disabled = false; } catch (err) { payload = null; p.innerHTML = `<div class="box" style="border-color:#b42318"><b>Could not read it:</b> ${esc(err.message)}</div>`; } };
  f.onsubmit = async e => { if (e.submitter.value !== "go" || !payload) return; e.preventDefault(); const p = $("#xp"), say = t => p.innerHTML = `<div class="box">${esc(t)}</div>`; $("#xgo").disabled = true;
    try {
      const c = await db.rpc("history_import_clients", { p: payload.clients }); if (c.error) throw c.error; say(`Clients done (${c.data.accounts_created} new credit accounts). Importing documents…`);
      let added = 0, skipped = 0, voided = 0;
      for (let i = 0; i < payload.docs.length; i += 25) { const r = await db.rpc("history_import", { p: payload.docs.slice(i, i + 25) }); if (r.error) throw r.error; added += r.data.added; skipped += r.data.already_there; voided += r.data.void; say(`Documents ${Math.min(i + 25, payload.docs.length)} of ${payload.docs.length}…`); }
      for (let i = 0; i < payload.prices.length; i += 100) { const r = await db.rpc("history_import_prices", { p: payload.prices.slice(i, i + 100) }); if (r.error) throw r.error; }
      p.innerHTML = `<div class="box" style="border-color:#067647"><b>Done.</b> ${added} documents imported (${voided} void), ${skipped} already there, ${c.data.accounts_created} credit accounts created, ${payload.prices.length} price-list items stored.</div>`;
      toast("History imported"); refreshLookups(); setTimeout(docsPage, 1200);
    } catch (err) { p.innerHTML = `<div class="box" style="border-color:#b42318"><b>Stopped:</b> ${esc(err.message || String(err))}. Records already imported stay; run the import again to continue.</div>`; $("#xgo").disabled = false; } };
  $("#dlg").showModal();
}
// ---- v20: quote follow-up, recurring monthly charges, margin while quoting ----------------------
const plusDays = (s, n) => { const x = new Date((s || iso(new Date())) + "T12:00:00"); x.setDate(x.getDate() + n); return iso(x); };
const qState = r => r.doc_type !== "Quotation" || docSt(r) !== "Issued" || !r.quote_state ? "" : (r.quote_state === "Sent" && r.valid_until && r.valid_until < iso(new Date()) ? "Expired" : r.quote_state);
const qTag = r => { const s = qState(r); return s ? ` <span class="tag ${s === "Accepted" ? "ok" : s === "Sent" ? "draft" : "bad"}">${s === "Sent" ? "Open" : s}</span>` : ""; };
function quoteDialog(r, after) {
  const f = $("#dlgForm"), cur = r.quote_state || "Sent";
  f.innerHTML = `<h2>Quotation ${esc(docNo(r))}: where does it stand?</h2><p style="margin-top:0">${esc(r.customer)} · KES ${kes(docTotals(r).total)}</p><div class="grid">
    <label>Status<select name="st">${[["Sent", "Open (sent, waiting)"], ["Accepted", "Accepted"], ["Lost", "Lost"], ["Expired", "Expired"]].map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label>Valid until<input name="vu" type="date" value="${esc(r.valid_until || plusDays(r.doc_date, 30))}"></label>
    <label id="fuL">Follow up on<input name="fu" type="date" value="${esc(r.follow_up || plusDays(null, 7))}"></label>
    <label class="full">Note (required if lost: price, no budget, chose someone else…)<input name="note" maxlength="200" value="${esc(r.outcome_note || "")}" autocomplete="off"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  const sync = () => { $("#fuL").hidden = f.elements.st.value !== "Sent"; }; sync(); f.onchange = sync; f.oninput = null; f.onclick = null;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const st = f.elements.st.value;
    const x = await db.rpc("quote_set_state", { p_id: r.id, p_state: st, p_note: f.elements.note.value.trim() || null, p_follow_up: st === "Sent" ? f.elements.fu.value || null : null, p_valid_until: f.elements.vu.value || null });
    if (x.error) return toast(x.error.message); $("#dlg").close(); toast("Saved"); after(); };
  $("#dlg").showModal();
}
// ---- v21: client equipment, documents vault, website projects and policies ------------------------
const daysTo = d => d ? Math.round((new Date(d + "T12:00:00") - new Date(iso(new Date()) + "T12:00:00")) / 864e5) : null;
const dueTag = (d, soon = 30, word = "Ends") => { const n = daysTo(d); if (n == null) return ""; return n < 0 ? `<span class="tag bad">Expired ${esc(d)}</span>` : n <= soon ? `<span class="tag bad">${word} in ${n} d</span> <small>${esc(d)}</small>` : esc(d); };
async function equipmentPage() {
  const can_ = can("equipment.edit");
  const [er, jr] = await Promise.all([db.from("equipment").select("*").order("id", { ascending: false }).limit(2000), can("jobs.view") ? db.from("field_jobs").select("id,job_no,client_name") : { data: [] }]);
  const rows = must(er) || [], jobs = (jr && jr.data) || [], jobNo = id => (jobs.find(j => j.id === id) || {}).job_no || "J-" + String(id).padStart(3, "0");
  const flt = { q: "", soon: false };
  const link = r => [r.repair_id ? "JC-" + String(r.repair_id).padStart(4, "0") : "", r.job_id ? jobNo(r.job_id) : ""].filter(Boolean).join(" · ");
  const draw = () => { const q = flt.q.toLowerCase(), v = rows.filter(r => (!flt.soon || (daysTo(r.warranty_end) != null && daysTo(r.warranty_end) <= 30)) && (!q || [r.customer_name, r.device_type, r.make_model, r.serial_no, r.mac_imei, r.location, link(r)].join(" ").toLowerCase().includes(q)));
    $("#etb").innerHTML = v.slice(0, 400).map((r, i) => `<tr><td><b>${esc(r.customer_name)}</b></td><td>${esc(r.device_type)}<br><small>${esc(r.make_model || "")}</small></td><td>${esc(r.serial_no || "")}${r.mac_imei ? `<br><small>${esc(r.mac_imei)}</small>` : ""}</td><td>${esc(r.location || "")}</td><td>${esc(r.installed_on || "")}</td><td>${dueTag(r.warranty_end)}</td><td>${esc(link(r))}</td>
      <td class="acts">${can_ ? `<button class="btn sm" data-e="${rows.indexOf(r)}">Edit</button> <button class="btn sm warn" data-d="${rows.indexOf(r)}">Delete</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="8">Nothing matches.</td></tr>`; $("#ecnt").textContent = v.length + " item(s)"; };
  $("#view").innerHTML = `<h2>Client equipment</h2><p style="color:var(--mut);margin-top:0">What you have installed or repaired for each customer: serial numbers, MAC / IMEI, where it is on site, install date and warranty.</p>
    <div class="bar">${can_ ? `<button class="btn" id="enew">+ New equipment</button>` : ""}<input id="eq" placeholder="Search customer, device, serial, MAC…" style="max-width:300px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="esoon" style="width:auto"> Warranty ending within 30 days</label><span id="ecnt" style="color:var(--mut)"></span></div>
    <div class="wrap"><table><thead><tr><th>Customer</th><th>Device</th><th>Serial / MAC / IMEI</th><th>Location on site</th><th>Installed</th><th>Warranty</th><th>Linked to</th><th></th></tr></thead><tbody id="etb"></tbody></table></div>`;
  draw(); $("#eq").oninput = e => { flt.q = e.target.value; draw(); }; $("#esoon").onchange = e => { flt.soon = e.target.checked; draw(); };
  if ($("#enew")) $("#enew").onclick = () => equipmentForm(null, jobs);
  $("#etb").onclick = async e => { const b = e.target.closest("button"); if (!b) return; const r = rows[b.dataset.e ?? b.dataset.d];
    if (b.dataset.e != null) equipmentForm(r, jobs);
    else if (confirm("Delete this equipment record?")) { const x = await db.from("equipment").delete().eq("id", r.id); if (x.error) toast(x.error.message); else equipmentPage(); } };
}
function equipmentForm(r, jobs) {
  const f = $("#dlgForm"), a = accounts.filter(x => x.active || (r && x.id === r.account_id)), ref = r ? [r.repair_id ? "JC-" + String(r.repair_id).padStart(4, "0") : "", ""] : ["", ""], jref = r && r.job_id ? ((jobs.find(j => j.id === r.job_id) || {}).job_no || "") : "";
  f.innerHTML = `<h2>${r ? "Edit" : "New"} equipment</h2><div class="grid">
    ${a.length ? `<label class="full">Credit account (optional)<select name="account_id"><option value="">— not on an account —</option>${a.map(x => `<option value="${x.id}" ${r && x.id === r.account_id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>` : ""}
    <label class="full">Customer<input name="customer_name" value="${esc(r?.customer_name || "")}" required autocomplete="off"></label>
    <label>Device type<input name="device_type" list="dl_dev" value="${esc(r?.device_type || "")}" required autocomplete="off"><datalist id="dl_dev">${["CCTV camera", "NVR / DVR", "Router", "Switch", "Access point", "UPS", "Laptop", "Desktop computer", "Printer", "Phone", "Distribution board", "Other"].map(x => `<option>${x}</option>`).join("")}</datalist></label>
    <label>Make / model<input name="make_model" value="${esc(r?.make_model || "")}" autocomplete="off"></label>
    <label>Serial number<input name="serial_no" value="${esc(r?.serial_no || "")}" autocomplete="off"></label><label>MAC address / IMEI<input name="mac_imei" value="${esc(r?.mac_imei || "")}" autocomplete="off"></label>
    <label class="full">Location on site<input name="location" value="${esc(r?.location || "")}" placeholder="e.g. Main gate, server room, ward 2" autocomplete="off"></label>
    <label>Install date<input name="installed_on" type="date" value="${esc(r?.installed_on || "")}"></label><label>Warranty ends<input name="warranty_end" type="date" value="${esc(r?.warranty_end || "")}"></label>
    <label>Repair it came from (e.g. JC-0012)<input name="repair_ref" value="${esc(ref[0])}" autocomplete="off"></label><label>Field job it belongs to (e.g. J-004)<input name="job_ref" value="${esc(jref)}" autocomplete="off"></label>
    <label class="full">Notes<input name="notes" value="${esc(r?.notes || "")}"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.oninput = null; f.onclick = null;
  f.onchange = e => { if (e.target.name === "account_id") { const x = accounts.find(y => String(y.id) === e.target.value); if (x && !f.elements.customer_name.value.trim()) f.elements.customer_name.value = x.name; } };
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const el = f.elements, v = k => el[k] && el[k].value.trim() || null;
    let repair_id = null, job_id = null; const rr = (v("repair_ref") || "").toUpperCase(), jj = (v("job_ref") || "").toUpperCase();
    if (rr) { const m = rr.match(/^JC-?0*(\d+)$/); if (!m) return toast("A repair number looks like JC-0012."); repair_id = Number(m[1]); const x = await db.from("repairs").select("id").eq("id", repair_id); if (x.error || !(x.data || []).length) return toast("There is no repair " + rr + "."); }
    if (jj) { const j = jobs.find(y => String(y.job_no).toUpperCase() === jj); if (!j) return toast("There is no field job " + jj + "."); job_id = j.id; }
    const row = { account_id: v("account_id") ? Number(v("account_id")) : null, customer_name: v("customer_name"), device_type: v("device_type"), make_model: v("make_model"), serial_no: v("serial_no"), mac_imei: v("mac_imei"), location: v("location"), installed_on: v("installed_on"), warranty_end: v("warranty_end"), repair_id, job_id, notes: v("notes") };
    if (row.installed_on && row.warranty_end && row.warranty_end < row.installed_on) return toast("The warranty cannot end before the install date.");
    const x = r ? await db.from("equipment").update(row).eq("id", r.id) : await db.from("equipment").insert(row); if (x.error) return toast(x.error.message); $("#dlg").close(); toast("Saved"); equipmentPage(); };
  $("#dlg").showModal();
}
// ---- company documents vault (files are in a private storage bucket called "vault")
const VAULT_KINDS = ["Tax compliance certificate (TCC)", "CR12", "Certificate of incorporation", "Business permit", "Other"];
async function vaultPage() {
  const rows = (must(await db.from("company_docs").select("*").order("expires_on", { ascending: true, nullsFirst: false }).limit(500)) || []);
  const sms = await db.rpc("vault_remind", {});
  const noPhone = sms.data && sms.data.problem === "no_phone";
  $("#view").innerHTML = `<h2>Company documents</h2><p style="color:var(--mut);margin-top:0">Keep your tax compliance certificate, CR12, certificate of incorporation and permits here. You get a Dashboard warning and a text message 30 days, 14 days and 7 days before one expires, and on the day.</p>
    ${noPhone ? `<p class="box" style="border-color:#b54708">Add your phone number to your user profile (Users &amp; roles) so the reminders can be texted to you.</p>` : ""}
    <div class="bar"><button class="btn" id="vnew">+ Add a document</button></div>
    <div class="wrap"><table><thead><tr><th>Document</th><th>Number</th><th>Issued</th><th>Expires</th><th>File</th><th></th></tr></thead><tbody id="vtb">${rows.map((r, i) => `<tr><td><b>${esc(r.title)}</b><br><small>${esc(r.kind)}</small></td><td>${esc(r.number || "")}</td><td>${esc(r.issued_on || "")}</td><td>${r.expires_on ? dueTag(r.expires_on, 30, "Expires") : "<small>no expiry</small>"}</td><td>${r.file_path ? `<button class="btn sm ghost" data-o="${i}">Open</button>` : "<small>no file</small>"}</td>
      <td class="acts"><button class="btn sm" data-e="${i}">Edit</button> <button class="btn sm warn" data-d="${i}">Delete</button></td></tr>`).join("") || `<tr><td colspan="6">Nothing yet. Press “+ Add a document”.</td></tr>`}</tbody></table></div>`;
  $("#vnew").onclick = () => vaultForm(null);
  $("#vtb").onclick = async e => { const b = e.target.closest("button"); if (!b) return; const k = Object.keys(b.dataset)[0], r = rows[b.dataset[k]];
    if (k === "e") vaultForm(r);
    else if (k === "o") { if (!db.storage) return toast("Files are not available here."); const u = await db.storage.from("vault").createSignedUrl(r.file_path, 120); if (u.error) return toast("Could not open the file: " + u.error.message + " (run database/storage_v21.sql once)"); window.open(u.data.signedUrl, "_blank"); }
    else if (k === "d" && confirm("Delete this document and its file?")) { if (r.file_path && db.storage) await db.storage.from("vault").remove([r.file_path]); const x = await db.from("company_docs").delete().eq("id", r.id); if (x.error) toast(x.error.message); else vaultPage(); } };
}
function vaultForm(r) {
  const f = $("#dlgForm"); let path = r?.file_path || null, fname = r?.file_name || null;
  f.innerHTML = `<h2>${r ? "Edit" : "Add"} company document</h2><div class="grid"><label>Type<select name="kind">${VAULT_KINDS.map(k => `<option ${r && r.kind === k ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></label><label>Name<input name="title" value="${esc(r?.title || "")}" required placeholder="e.g. TCC 2026" autocomplete="off"></label>
    <label>Number<input name="number" value="${esc(r?.number || "")}" autocomplete="off"></label><label>Issued on<input name="issued_on" type="date" value="${esc(r?.issued_on || "")}"></label><label>Expires on (leave empty if it never expires)<input name="expires_on" type="date" value="${esc(r?.expires_on || "")}"></label>
    <label class="full">File (PDF or photo, up to 5 MB)<input type="file" name="file" accept="application/pdf,image/*"><small id="vmsg" style="color:var(--mut)">${fname ? "Current file: " + esc(fname) : ""}</small></label><label class="full">Notes<input name="notes" value="${esc(r?.notes || "")}"></label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.oninput = null; f.onclick = null; f.onchange = null;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const el = f.elements, file = el.file.files[0], v = k => el[k].value.trim() || null;
    if (file) { if (!db.storage) return toast("Files are not available here."); if (file.size > 5 * 1024 * 1024) return toast("That file is over 5 MB.");
      const np = Date.now() + "-" + file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60); $("#vmsg").textContent = "Uploading…";
      const up = await db.storage.from("vault").upload(np, file, { contentType: file.type, upsert: false }); if (up.error) { $("#vmsg").textContent = ""; return toast("Upload failed: " + up.error.message + " (run database/storage_v21.sql once)"); }
      if (path) await db.storage.from("vault").remove([path]); path = np; fname = file.name; }
    const row = { kind: el.kind.value, title: v("title"), number: v("number"), issued_on: v("issued_on"), expires_on: v("expires_on"), notes: v("notes"), file_path: path, file_name: fname };
    const x = r ? await db.from("company_docs").update(row).eq("id", r.id) : await db.from("company_docs").insert(row); if (x.error) return toast(x.error.message);
    $("#dlg").close(); toast("Saved"); await db.rpc("vault_remind", {}); vaultPage(); };
  $("#dlg").showModal();
}
// ---- website projects: finished jobs shown on the homepage and the Projects page
async function projectsPage() {
  const rows = must(await db.from("site_projects").select("*").order("id", { ascending: false }).limit(300)) || [];
  const jr = can("jobs.view") ? await db.from("field_jobs").select("id,job_no,client_name,job_type,completed_on,status").eq("status", "Completed") : { data: [] };
  const jobs = (jr.data || []), free = jobs.filter(j => !rows.some(p => p.job_id === j.id));
  $("#view").innerHTML = `<h2>Website projects</h2><p style="color:var(--mut);margin-top:0">Show finished work on the website. A project needs a completed field job, at least one photo, and a tick that the client agreed. The three newest published projects show on the home page.</p>
    <div class="bar"><select id="pj"><option value="">Choose a completed job…</option>${free.map(j => `<option value="${j.id}">${esc(j.job_no)} · ${esc(j.client_name)} · ${esc(j.job_type || "")}</option>`).join("")}</select><button class="btn" id="pnew">Show it on the website</button></div>
    <div class="wrap"><table><thead><tr><th>Project</th><th>Job</th><th>Photos</th><th>Client agreed</th><th>On the website</th><th></th></tr></thead><tbody id="ptb">${rows.map((p, i) => `<tr><td><b>${esc(p.title)}</b><br><small>${esc(p.client_label || "")}</small></td><td>${esc((jobs.find(j => j.id === p.job_id) || {}).job_no || "")}</td><td>${(p.photos || []).length}</td><td>${p.client_ok ? "Yes" : "No"}</td><td><span class="tag ${p.published ? "ok" : "draft"}">${p.published ? "Published" : "Hidden"}</span></td><td class="acts"><button class="btn sm" data-e="${i}">Edit</button> <button class="btn sm warn" data-d="${i}">Delete</button></td></tr>`).join("") || `<tr><td colspan="6">No projects yet.</td></tr>`}</tbody></table></div>`;
  $("#pnew").onclick = () => { const id = Number($("#pj").value); if (!id) return toast("Choose a completed job first."); projectDialog(jobs.find(j => j.id === id), null); };
  $("#ptb").onclick = async e => { const b = e.target.closest("button"); if (!b) return; const k = Object.keys(b.dataset)[0], p = rows[b.dataset[k]];
    if (k === "e") projectDialog(jobs.find(j => j.id === p.job_id) || null, p);
    else if (k === "d" && confirm("Delete this project from the website?")) { const x = await db.from("site_projects").delete().eq("id", p.id); if (x.error) toast(x.error.message); else projectsPage(); } };
}
async function projectDialog(job, p, after) {
  const f = $("#dlgForm"); let photos = (p?.photos || []).slice();
  if (!p && job) { const ex = await db.from("site_projects").select("*").eq("job_id", job.id); const e0 = Array.isArray(ex.data) ? ex.data[0] : ex.data; if (e0) { p = e0; photos = (p.photos || []).slice(); } }
  const draw = () => { f.innerHTML = `<h2>${p ? "Edit" : "New"} website project</h2><p style="margin-top:0">${job ? "From job " + esc(job.job_no) + " (" + esc(job.client_name) + "). The client's name is not shown on the website unless you type it below." : ""}</p><div class="grid">
    <label class="full">Title (shown on the website)<input name="title" value="${esc(p?.title || (job ? (job.job_type || "Project") : ""))}" required minlength="3" maxlength="90" autocomplete="off"></label>
    <label class="full">Short description (what was done)<input name="summary" value="${esc(p?.summary || "")}" maxlength="400" autocomplete="off"></label>
    <label>Who it was for (optional, e.g. “A school in Meru”)<input name="client_label" value="${esc(p?.client_label || "")}" maxlength="80" autocomplete="off"></label>
    <label>Finished on<input name="completed_on" type="date" value="${esc(p?.completed_on || job?.completed_on || "")}"></label>
    <div class="full"><b>Photos</b> <small style="color:var(--mut)">(up to 8; the first one is the cover)</small><div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">${photos.map((u, i) => `<span style="position:relative"><img src="${esc(u)}" alt="" style="height:70px;width:90px;object-fit:cover;border-radius:8px"><button type="button" class="btn sm warn" data-rp="${i}" style="position:absolute;top:2px;right:2px;padding:0 6px">✕</button></span>`).join("")}</div>
      <input type="file" name="pic" accept="image/*" multiple><small id="pmsg" style="color:var(--mut)"></small><label style="margin-top:6px">…or paste a photo address<input name="url" placeholder="https://…" autocomplete="off"></label><button type="button" class="btn sm ghost" id="purl">Add that address</button></div>
    <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="client_ok" ${p?.client_ok ? "checked" : ""} style="width:auto"> The client agreed to us showing this work and these photos</label>
    <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="published" ${p?.published ? "checked" : ""} style="width:auto"> Show it on the website now</label></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`; };
  const keep = () => { for (const k of ["title", "summary", "client_label", "completed_on"]) if (f.elements[k]) (p = p || {})[k] = f.elements[k].value; if (f.elements.client_ok) { (p = p || {}).client_ok = f.elements.client_ok.checked; p.published = f.elements.published.checked; } };
  draw(); f.oninput = null;
  f.onclick = e => { const b = e.target.closest("[data-rp]"); if (b) { keep(); photos.splice(Number(b.dataset.rp), 1); draw(); } if (e.target.id === "purl") { const u = f.elements.url.value.trim(); if (!/^https?:\/\/\S+$/.test(u)) return toast("That does not look like a web address."); if (photos.length >= 8) return toast("Eight photos at most."); keep(); photos.push(u); draw(); } };
  f.onchange = async e => { if (e.target.name !== "pic") return; const files = [...e.target.files], msg = $("#pmsg"); if (!db.storage) { msg.textContent = "Photo upload is not available here. Paste a photo address instead."; return; } keep();
    for (const file of files) { if (photos.length >= 8) break; if (file.size > 3 * 1024 * 1024) { msg.textContent = file.name + " is over 3 MB and was skipped."; continue; } msg.textContent = "Uploading " + file.name + "…";
      const np = "projects/" + Date.now() + "-" + file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-50), up = await db.storage.from("shop").upload(np, file, { contentType: file.type, upsert: false });
      if (up.error) { msg.textContent = "Upload failed: " + up.error.message + " (run database/storage_v21.sql once)"; continue; } photos.push(db.storage.from("shop").getPublicUrl(np).data.publicUrl); }
    draw(); };
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const el = f.elements;
    const row = { job_id: job ? job.id : (p?.job_id ?? null), title: el.title.value.trim(), summary: el.summary.value.trim() || null, client_label: el.client_label.value.trim() || null, job_type: job?.job_type || p?.job_type || null, completed_on: el.completed_on.value || null, photos, client_ok: el.client_ok.checked, published: el.published.checked };
    const x = p && p.id ? await db.from("site_projects").update(row).eq("id", p.id) : await db.from("site_projects").insert(row); if (x.error) return toast(x.error.message);
    $("#dlg").close(); toast(row.published ? "Saved and shown on the website" : "Saved (not shown on the website)"); (after || projectsPage)(); };
  $("#dlg").showModal();
}
// ---- website policy pages
async function policiesPage() {
  const rows = must(await db.from("site_policies").select("*")) || [], order = ["customer-service", "warranty-returns", "anti-bribery"];
  rows.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  $("#view").innerHTML = `<h2>Website policies</h2><p style="color:var(--mut);margin-top:0">These three pages appear on the website under Policies. Write your own text below. A blank line starts a new paragraph, and a line that begins with “## ” becomes a heading.</p>
    ${rows.map((r, i) => `<form class="card" data-i="${i}" style="margin-bottom:14px"><label>Title<input name="title" value="${esc(r.title)}" maxlength="120"></label><label style="margin-top:8px">Text<textarea name="body" rows="9" style="width:100%">${esc(r.body)}</textarea></label>
      <div class="bar" style="margin-top:8px"><button class="btn" type="submit">Save</button><a class="btn ghost" href="policy.html?p=${esc(r.slug)}" target="_blank" rel="noopener">View on the website</a><small style="color:var(--mut)">Last changed ${esc(String(r.updated_at || "").slice(0, 10))}</small></div></form>`).join("")}`;
  $("#view").onsubmit = async e => { e.preventDefault(); const f = e.target.closest("form"), r = rows[f.dataset.i]; const x = await db.from("site_policies").update({ title: f.elements.title.value, body: f.elements.body.value }).eq("slug", r.slug); if (x.error) return toast(x.error.message); toast("Saved. It is live on the website now."); };
}

// ---- v22: post income from a finished repair / job (cash + M-Pesa), autofill, and payments to the till ------------------------------
const TILL_NO = "643844";
function parseMpesa(t) {
  const m = String(t || ""), up = m.toUpperCase(); let code = null;
  for (const x of up.matchAll(/(?:^|[^A-Z0-9])([A-Z][A-Z0-9]{9})(?=[^A-Z0-9]|$)/g)) if (/[0-9]/.test(x[1])) { code = x[1]; break; }
  const a = m.match(/ksh\.?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
  return { code, amount: a ? Number(a[1].replace(/,/g, "")) : null };
}
// finds a repair (JC-0012) or a field job (J-004) and says what is owed on it
async function lookupRef(ref) {
  const r = String(ref || "").toUpperCase().replace(/\s+/g, "");
  if (/^JC-?\d+$/.test(r)) { const id = Number(r.replace(/\D/g, "")); const x = await db.from("v_repairs").select("*").eq("id", id); const row = Array.isArray(x.data) ? x.data[0] : x.data; if (!row) return null;
    return { ref: "JC-" + String(id).padStart(4, "0"), who: row.customer_name, contact: row.contact, due: Number(row.balance_due) || 0, type: "Repair", stage: row.stage, desc: "Repair JC-" + String(id).padStart(4, "0") + ": " + (row.brand_model || row.item_type || "device") }; }
  if (/^J-?\d+$/.test(r)) { const n = "J-" + String(Number(r.replace(/\D/g, ""))).padStart(3, "0"); const x = await db.from("v_jobs").select("*").eq("job_no", n); const row = Array.isArray(x.data) ? x.data[0] : x.data; if (!row) return null;
    const jt = row.job_type || ""; return { ref: n, who: row.client_name, contact: row.contact, due: Math.max(Number(row.balance) || 0, 0), type: jt === "CCTV installation" ? "CCTV installation" : /^Electrical/.test(jt) ? "Electrical installation" : "Other service", stage: row.status, desc: "Job " + n + ": " + (jt || "field job") + " for " + row.client_name }; }
  return null;
}
async function postIncomeDialog(init) {
  const f = $("#dlgForm"); let cur = init && init.ref ? await lookupRef(init.ref) : null;
  f.oninput = f.onchange = f.onclick = null;
  f.innerHTML = `<h2>Post income from a repair or job</h2><p style="margin-top:0;color:var(--mut)">Records what the customer paid for one repair or field job. If they paid part in cash and part by M-Pesa, enter both amounts and both lines are saved together.</p>
    <div class="grid"><label class="full">Repair or job number<input name="ref" value="${esc(init?.ref || "")}" placeholder="JC-0012 or J-004" autocomplete="off" required></label>
    <div class="full box" id="pi_info" style="margin:0"></div>
    <label>Date<input name="date" type="date" value="${iso(new Date())}"></label><label>Note (optional)<input name="note" autocomplete="off"></label>
    <label>Paid in cash (KES)<input name="cash" type="number" step="0.01" min="0" inputmode="decimal"></label><label>Paid by M-Pesa (KES)<input name="mpesa" type="number" step="0.01" min="0" inputmode="decimal"></label>
    <label class="full">M-Pesa code (or paste the whole M-Pesa message here)<input name="code" autocomplete="off" placeholder="SGH7K2L9XQ"></label>
    <div class="full"><button type="button" class="btn sm ghost" id="pi_cash">All cash</button> <button type="button" class="btn sm ghost" id="pi_mp">All M-Pesa</button> <span id="pi_left" style="margin-left:8px"></span></div></div>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Post income</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  const el = f.elements, num = n => Number(el[n].value) || 0;
  const info = () => { $("#pi_info").innerHTML = cur ? `<b>${esc(cur.ref)}</b> · ${esc(cur.who)}${cur.contact ? " · " + esc(cur.contact) : ""}<br>${esc(cur.stage || "")} · balance due <b>KES ${kes(cur.due)}</b>${["Ready for collection", "Collected", "Completed"].includes(cur.stage) ? "" : `<br><span class="tag bad">Not finished yet</span> You can still post a payment received now.`}` : `<span style="color:var(--mut)">Type a repair or job number to see what is owed.</span>`; left(); };
  const left = () => { const t = num("cash") + num("mpesa"), d = cur ? cur.due - t : null; $("#pi_left").innerHTML = cur ? (d < 0 ? `<span class="tag bad">KES ${kes(-d)} more than the balance</span>` : `Left to pay after this: <b>KES ${kes(d)}</b>`) : ""; };
  const find = async () => { cur = await lookupRef(el.ref.value); if (cur && el.ref.value.trim() !== cur.ref) el.ref.value = cur.ref; info(); if (cur && !num("cash") && !num("mpesa") && cur.due > 0) el.cash.value = cur.due; left(); };
  info(); if (cur && cur.due > 0) { el.cash.value = cur.due; left(); }
  f.onchange = e => { if (e.target.name === "ref") find(); };
  f.oninput = e => { if (e.target.name === "code" && e.target.value.length > 14) { const p = parseMpesa(e.target.value); if (p.code) { e.target.value = p.code; if (p.amount && !num("mpesa")) { el.mpesa.value = p.amount; if (num("cash") === (cur ? cur.due : -1)) el.cash.value = Math.max((cur ? cur.due : 0) - p.amount, 0) || ""; } } } left(); };
  f.onclick = e => { if (e.target.id === "pi_cash") { el.cash.value = cur ? cur.due : ""; el.mpesa.value = ""; left(); } if (e.target.id === "pi_mp") { el.mpesa.value = cur ? cur.due : ""; el.cash.value = ""; left(); } };
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    if (!cur) { await find(); if (!cur) return toast("There is no repair or job with that number."); }
    const cash = num("cash"), mp = num("mpesa"); if (cash + mp <= 0) return toast("Enter the cash amount, the M-Pesa amount, or both.");
    if (mp > 0 && !el.code.value.trim()) return toast("Type the M-Pesa code for the M-Pesa part.");
    const x = await db.rpc("post_job_income", { p_ref: cur.ref, p_cash: cash || 0, p_mpesa: mp || 0, p_mpesa_ref: el.code.value.trim() || null, p_date: el.date.value || null, p_note: el.note.value.trim() || null });
    if (x.error) return toast(x.error.message);
    $("#dlg").close(); toast("Posted KES " + kes(cash + mp) + " to " + cur.ref + (x.data && Number(x.data.balance_after) > 0 ? ". Balance left KES " + kes(x.data.balance_after) : ". Fully paid.")); route(); };
  $("#dlg").showModal();
}
// typing a repair / job number in the ordinary Income form fills the rest in
function wireIncomeFill(f) {
  f.onchange = async e => { if (e.target.name !== "ref" || !f.elements.description || !f.elements.income_type) return; const c = await lookupRef(e.target.value); if (!c) return;
    e.target.value = c.ref; if (!f.elements.description.value.trim()) f.elements.description.value = c.desc; if (!Number(f.elements.amount.value) && c.due > 0) f.elements.amount.value = c.due; f.elements.income_type.value = c.type;
    let h = f.querySelector("#refhint"); if (!h) { e.target.parentElement.insertAdjacentHTML("beforeend", `<small id="refhint" style="display:block;color:var(--mut);font-weight:400"></small>`); h = f.querySelector("#refhint"); }
    h.textContent = c.who + " · balance due KES " + kes(c.due); };
}
// pasting a whole M-Pesa message into any "M-Pesa code" box keeps just the code (and fills an empty amount)
function mpesaPasteFix(f) {
  return e => { const n = e.target.name; if ((n !== "mpesa_ref" && n !== "deposit_mpesa_ref") || e.target.value.length < 15) return; const p = parseMpesa(e.target.value); if (!p.code) return; e.target.value = p.code;
    if (n === "mpesa_ref" && p.amount && f.elements.amount && !Number(f.elements.amount.value)) f.elements.amount.value = p.amount; if (n === "deposit_mpesa_ref" && p.amount && f.elements.deposit_received && !Number(f.elements.deposit_received.value)) f.elements.deposit_received.value = p.amount; };
}
// new repair: show what the parts cost the customer (and what they cost you) from the stock list as you pick them
let costMap = null;
async function wireRepairBill(f) {
  if (can("costs.view") && !costMap) { const r = await db.from("item_costs").select("item_id,unit_cost"); costMap = {}; ((r && r.data) || []).forEach(x => { costMap[x.item_id] = Number(x.unit_cost) || 0; }); }
  f.querySelector(".bar").insertAdjacentHTML("beforebegin", `<p class="box" id="bill" style="margin:10px 0 0"></p>`);
  const stock = id => stockItems.find(s => String(s.id) === String(id));
  const bill = () => { if (!f.querySelector("#bill")) return; const g = n => f.elements[n]; let sell = 0, buy = 0, warn = "";
    for (const n of [1, 2]) { const id = g("part" + n + "_id") && g("part" + n + "_id").value; if (!id) continue; const s = stock(id) || {}, q = (g("part" + n + "_qty") && Number(g("part" + n + "_qty").value)) || 1; sell += (Number(s.selling_price) || 0) * q; buy += (costMap ? costMap[id] || 0 : 0) * q; if (q > Number(s.on_hand)) warn += `<br><span class="tag bad">Only ${s.on_hand} of ${esc(s.description)} in stock</span>`; }
    f.querySelectorAll("#xlines [data-line]").forEach(l => { const q = Number(l.querySelector("[name=li_qty]").value) || 0, p = Number(l.querySelector("[name=li_price]").value) || 0, it = l.querySelector("[name=li_item]").value; sell += q * p; if (it && costMap) buy += (costMap[it] || 0) * q; });
    const lab = (g("labor_cost") && Number(g("labor_cost").value)) || 0, tot = sell + lab;
    f.querySelector("#bill").innerHTML = `Parts and items <b>KES ${kes(sell)}</b> + labour <b>KES ${kes(lab)}</b> = estimated bill <b>KES ${kes(tot)}</b>` + (costMap ? `<br><small>Buying cost of the stocked parts KES ${kes(buy)} · profit about KES ${kes(tot - buy)}</small>` : "") + warn; };
  f.onchange = e => { const m = /^part([12])_id$/.exec(e.target.name || ""); if (m && e.target.value) { const q = f.elements["part" + m[1] + "_qty"]; if (q && !Number(q.value)) q.value = 1; } bill(); };
  bill(); return bill;
}
// ---- customer payments to the till, waiting for you to confirm
async function tillPage() {
  const rows = must(await db.from("v_till_claims").select("*").order("id", { ascending: false }).limit(300)) || [];
  const pend = rows.filter(r => r.status === "Pending"), done = rows.filter(r => r.status !== "Pending");
  const kind = { repair: "Repair", job: "Field job", order: "Shop order", account: "Credit account" };
  const line = r => `<tr><td>${esc(String(r.created_at || "").replace("T", " ").slice(0, 16))}</td><td><b>${esc(r.ref)}</b><br><small>${esc(kind[r.kind] || "")} · ${esc(r.customer || "")}</small></td><td><b>${esc(r.receipt)}</b></td><td class="n">${kes(r.amount)}</td><td class="n">${kes(r.balance_due)}</td>
    <td>${r.stmt_amount != null ? (Number(r.stmt_amount) === Number(r.amount) ? `<span class="tag ok">On your till statement</span>` : `<span class="tag bad">On statement as KES ${kes(r.stmt_amount)}</span>`) : `<span class="tag draft">Not on the statement yet</span>`}${r.warning ? `<br><small style="color:#b54708">${esc(r.warning)}</small>` : ""}</td>
    <td><small>${esc(r.message)}</small></td><td class="acts">${r.status === "Pending" ? `<button class="btn sm" data-c="${r.id}">Confirm</button> <button class="btn sm warn" data-r="${r.id}">Reject</button>` : `<span class="tag ${r.status === "Confirmed" ? "ok" : "bad"}">${esc(r.status)}</span>${r.note ? `<br><small>${esc(r.note)}</small>` : ""}`}</td></tr>`;
  const tbl = (rs, empty) => `<div class="wrap"><table><thead><tr><th>Received</th><th>For</th><th>M-Pesa code</th><th>Amount</th><th>Owed now</th><th>Check</th><th>Message pasted</th><th></th></tr></thead><tbody>${rs.map(line).join("") || `<tr><td colspan="8">${empty}</td></tr>`}</tbody></table></div>`;
  $("#view").innerHTML = `<h2>Payments to the till</h2><p style="color:var(--mut);margin-top:0">When a customer's payment prompt does not work they pay till <b>${TILL_NO}</b> and paste the M-Pesa message on the website. Check each one against your M-Pesa statement (import it under M-Pesa reconcile; tills linked to Kopo Kopo appear by themselves), then press <b>Confirm</b>. Only then is it added to your income, linked to the job, with the M-Pesa code.</p>
    <h3>Waiting for you <span class="tag">${pend.length}</span></h3>${tbl(pend, "Nothing waiting.")}<h3>Decided</h3>${tbl(done.slice(0, 60), "None yet.")}`;
  $("#view").onclick = async e => { const b = e.target.closest("button"); if (!b) return; const id = Number(b.dataset.c || b.dataset.r), r = rows.find(x => x.id === id); if (!r) return;
    if (b.dataset.c) { if (r.stmt_amount == null && !confirm("This code is not on a till statement you have imported yet. Confirm anyway?")) return; if (!confirm(`Add KES ${kes(r.amount)} (${r.receipt}) to ${r.ref}?`)) return;
      const x = await db.rpc("till_decide", { p_id: id, p_action: "confirm" }); if (x.error) return toast(x.error.message); toast("Confirmed and posted to " + r.ref); tillPage(); }
    else { const f = $("#dlgForm"); f.oninput = f.onchange = f.onclick = null; f.innerHTML = `<h2>Reject ${esc(r.receipt)}</h2><label>Why? (kept on record)<input name="why" required autocomplete="off" placeholder="Not on the till statement"></label><div class="bar" style="margin-top:14px"><button class="btn warn" value="save">Reject</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
      f.onsubmit = async ev => { if (ev.submitter.value !== "save") return; ev.preventDefault(); const x = await db.rpc("till_decide", { p_id: id, p_action: "reject", p_note: f.elements.why.value }); if (x.error) return toast(x.error.message); $("#dlg").close(); toast("Rejected"); tillPage(); }; $("#dlg").showModal(); } };
}

// ---- v23: Landlord WiFi (Centipid) revenue --------------------------------------------------------------------------------------
function csvLine(l) { const out = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; }
// reads a Centipid analytics report: returns { period, days: {date: {revenue, bytes}}, methods, name }
function parseCentipid(text, name) {
  const lines = String(text || "").replace(/^﻿/, "").split(/\r?\n/).map(csvLine);
  if (!lines.length || !/centipid/i.test(lines[0][0] || "")) throw new Error(name + " is not a Centipid analytics report.");
  const out = { name, period: "", days: {}, methods: [] }, sect = t => lines.findIndex(r => (r[0] || "").trim().toLowerCase() === t);
  const per = lines.find(r => (r[0] || "").trim() === "Period"); out.period = per ? per[1] : "";
  const read = (title, fn) => { const i = sect(title); if (i < 0) return 0; let n = 0; for (let j = i + 2; j < lines.length && (lines[j][0] || "").trim() !== ""; j++) { fn(lines[j]); n++; } return n; };
  const dayOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const a = read("daily revenue", r => { if (dayOk(r[0])) (out.days[r[0]] = out.days[r[0]] || { revenue: 0, bytes: 0 }).revenue = Number(r[1]) || 0; });
  const b = read("daily data usage", r => { if (dayOk(r[0])) (out.days[r[0]] = out.days[r[0]] || { revenue: 0, bytes: 0 }).bytes = Number(r[1]) || 0; });
  read("payment methods", r => out.methods.push({ method: r[0], amount: Number(r[1]) || 0, count: Number(r[2]) || 0 }));
  if (!a && !b) throw new Error(name + " has no daily revenue or data table.");
  return out;
}
const fmtBytes = b => { b = Number(b) || 0; return b >= 1e12 ? (b / 1e12).toFixed(2) + " TB" : b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : (b / 1e6).toFixed(0) + " MB"; };
function wifiCosts(dayRows, wexp, MN) {
  const isHw = x => /hardware$/i.test(x.category || ""), ms = {};
  dayRows.forEach(r => { const o = ms[r.day.slice(0, 7)] = ms[r.day.slice(0, 7)] || { rev: 0, run: 0, hw: 0 }; o.rev += Number(r.revenue); });
  const cats = {}; let totRun = 0, totHw = 0, totRev = 0;
  wexp.forEach(x => { const m = x.spent_on.slice(0, 7), o = ms[m] = ms[m] || { rev: 0, run: 0, hw: 0 }, a = Number(x.amount); if (isHw(x)) { o.hw += a; totHw += a; } else { o.run += a; totRun += a; } const c = (x.category || "").replace(/^Landlord WiFi - ?/, "") || "Other"; cats[c] = (cats[c] || 0) + a; });
  Object.values(ms).forEach(o => totRev += o.rev);
  const keys = Object.keys(ms).sort().reverse();
  if (!keys.length) return "";
  const pct = (a, b) => b > 0 ? Math.round(a / b * 100) + "%" : "";
  return `<h3>Costs and profit</h3><p style="color:var(--mut);margin-top:0"><small>From Expenses with a category starting <b>Landlord WiFi</b>. Running costs are bandwidth, electricity, SMS, software and anything else. <b>Hardware</b> (routers, cable) is equipment you keep, so it is shown on its own.</small></p>
    <div class="wrap"><table><thead><tr><th>Month</th><th>Revenue</th><th>Running costs</th><th>Profit before hardware</th><th>Margin</th><th>Hardware</th><th>After hardware</th></tr></thead><tbody>${keys.map(m => { const o = ms[m]; return `<tr><td><b>${MN[Number(m.slice(5))]} ${m.slice(0, 4)}</b></td><td class="n">${kes(o.rev)}</td><td class="n">${kes(o.run)}</td><td class="n">${kes(o.rev - o.run)}</td><td>${pct(o.rev - o.run, o.rev)}</td><td class="n">${kes(o.hw)}</td><td class="n">${kes(o.rev - o.run - o.hw)}</td></tr>`; }).join("")}
    <tr><td><b>Total</b></td><td class="n"><b>${kes(totRev)}</b></td><td class="n"><b>${kes(totRun)}</b></td><td class="n"><b>${kes(totRev - totRun)}</b></td><td>${pct(totRev - totRun, totRev)}</td><td class="n"><b>${kes(totHw)}</b></td><td class="n"><b>${kes(totRev - totRun - totHw)}</b></td></tr></tbody></table></div>
    <p style="color:var(--mut)"><small>Where the costs went: ${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => esc(c) + " " + kes(v)).join(", ")}.</small></p>`;
}
async function wifiPage() {
  const dayRows = (must(await db.from("wifi_daily").select("*").order("day", { ascending: true }).limit(3000)) || []);
  const incRows = can("income.view") ? (must(await db.from("income").select("ref,amount").eq("income_type", "Landlord WiFi")) || []) : [];
  const posted = Object.fromEntries(incRows.map(r => [r.ref, Number(r.amount)]));
  const wexp = can("expenses.view") ? (must(await db.from("expenses").select("spent_on,category,amount,description").like("category", "Landlord WiFi%").order("spent_on", { ascending: true }).limit(2000)) || []) : null;
  const months = {}; dayRows.forEach(r => { const m = r.day.slice(0, 7), o = months[m] = months[m] || { rev: 0, bytes: 0, days: 0, paying: 0 }; o.rev += Number(r.revenue); o.bytes += Number(r.bytes); o.days++; if (Number(r.revenue) > 0) o.paying++; });
  const keys = Object.keys(months).sort().reverse(), can_ = can("income.add"), MN = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const last = dayRows.slice(-14).reverse();
  $("#view").innerHTML = `<h2>Landlord WiFi</h2><p style="color:var(--mut);margin-top:0">Payments from your PPPoE customers go to their own till and are billed in Centipid. Upload Centipid's analytics reports here (Centipid > Analytics > export CSV): <b>Monthly</b>, <b>Yearly</b> or a <b>custom date range</b>. Days that are already saved are updated, never counted twice. Then add each month to your Income with one press.</p>
    ${can_ ? `<div class="card" style="margin:10px 0"><label>Centipid report(s) (CSV, you may choose several)<input type="file" id="wf" accept=".csv,text/csv" multiple></label><div id="wprev"></div></div>` : ""}
    <h3>Months</h3><div class="wrap"><table><thead><tr><th>Month</th><th>Revenue (KES)</th><th>Data used</th><th>Days saved</th><th>KES per GB</th><th>In your Income</th><th></th></tr></thead><tbody id="wtb">${keys.map(m => { const o = months[m], ref = "WIFI-" + m, inc = posted[ref], gb = o.bytes / 1e9, st = inc == null ? `<span class="tag draft">Not added</span>` : inc === o.rev ? `<span class="tag ok">KES ${kes(inc)}</span>` : `<span class="tag bad">KES ${kes(inc)} (differs)</span>`;
      return `<tr><td><b>${MN[Number(m.slice(5))]} ${m.slice(0, 4)}</b></td><td class="n">${kes(o.rev)}</td><td>${fmtBytes(o.bytes)}</td><td>${o.days}</td><td class="n">${gb > 0 ? (o.rev / gb).toFixed(2) : ""}</td><td>${st}</td><td class="acts">${can_ && inc !== o.rev && o.rev > 0 ? `<button class="btn sm" data-m="${m}">${inc == null ? "Add to income" : "Update income"}</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="7">Nothing yet. Upload a Centipid report above.</td></tr>`}</tbody></table></div>
    ${wexp ? wifiCosts(dayRows, wexp, MN) : ""}
    ${last.length ? `<h3>Latest days</h3><div class="wrap"><table><thead><tr><th>Day</th><th>Revenue (KES)</th><th>Data used</th></tr></thead><tbody>${last.map(r => `<tr><td>${esc(r.day)}</td><td class="n">${kes(r.revenue)}</td><td>${fmtBytes(r.bytes)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <p style="color:var(--mut)"><small>The current month stays "open": upload a newer report later and press <b>Update income</b> to bring that month's income line up to date. A day's figure is only ever raised, so uploading an older file again is safe.</small></p>`;
  if ($("#wf")) $("#wf").onchange = async e => {
    const prev = $("#wprev"), files = [...e.target.files]; prev.innerHTML = ""; if (!files.length) return;
    const merged = {}, info = [];
    for (const f of files) { try { const r = parseCentipid(await f.text(), f.name); info.push(`<li><b>${esc(f.name)}</b>: ${esc(r.period)}, ${Object.keys(r.days).length} days${r.methods.length ? "; " + r.methods.filter(m => m.amount).map(m => esc(m.method) + " KES " + kes(m.amount)).join(", ") : ""}</li>`);
        for (const [d, v] of Object.entries(r.days)) { const o = merged[d] = merged[d] || { revenue: 0, bytes: 0 }; o.revenue = Math.max(o.revenue, v.revenue); o.bytes = Math.max(o.bytes, v.bytes); } }
      catch (err) { prev.innerHTML = `<p class="msg bad">${esc(err.message)}</p>`; return; } }
    let ds = Object.keys(merged).sort(); const first = ds.findIndex(d => merged[d].revenue > 0 || merged[d].bytes > 0); ds = first < 0 ? [] : ds.slice(first);   // skip the empty days before WiFi billing began
    if (!ds.length) { prev.innerHTML = `<ul>${info.join("")}</ul><p class="msg bad">There are no days with revenue or data in these files.</p>`; return; }
    const rows = ds.map(d => ({ day: d, revenue: merged[d].revenue, bytes: merged[d].bytes })), tot = rows.reduce((s, r) => s + r.revenue, 0);
    prev.innerHTML = `<ul>${info.join("")}</ul><p><b>${rows.length} days</b> from ${esc(ds[0])} to ${esc(ds[ds.length - 1])}, revenue <b>KES ${kes(tot)}</b>, data ${fmtBytes(rows.reduce((s, r) => s + r.bytes, 0))}.</p><button class="btn" id="wgo">Save these days</button> <span id="wmsg"></span>`;
    $("#wgo").onclick = async () => { $("#wgo").disabled = true; for (let i = 0; i < rows.length; i += 400) { const x = await db.rpc("wifi_import", { p_rows: rows.slice(i, i + 400), p_source: "csv" }); if (x.error) { $("#wmsg").textContent = x.error.message; $("#wgo").disabled = false; return; } }
      toast("Saved " + rows.length + " days"); wifiPage(); };
  };
  $("#wtb").onclick = async e => { const b = e.target.closest("button[data-m]"); if (!b) return; const x = await db.rpc("wifi_post_income", { p_month: b.dataset.m + "-01" }); if (x.error) return toast(x.error.message);
    toast(x.data.action === "posted" ? "Added KES " + kes(x.data.amount) + " to Income" : "Income line updated to KES " + kes(x.data.amount)); wifiPage(); };
}

async function quotesPage() {
  await loadCompany();
  const all = (must(await db.from("documents").select("*").eq("doc_type", "Quotation").eq("status", "Issued").order("id", { ascending: false }).limit(2000)) || []).filter(r => r.quote_state);
  const today = iso(new Date()), ageOf = r => Math.max(0, Math.round((new Date(today) - new Date(r.doc_date || today)) / 864e5));
  const open = all.filter(r => qState(r) === "Sent").sort((a, b) => String(a.follow_up || "9999").localeCompare(String(b.follow_up || "9999")));
  const yearAgo = plusDays(today, -365), dec = all.filter(r => (r.issued_at || r.doc_date || "") >= yearAgo), won = dec.filter(r => qState(r) === "Accepted").length, lostN = dec.filter(r => qState(r) === "Lost").length, expN = dec.filter(r => qState(r) === "Expired").length;
  const rate = won + lostN + expN ? Math.round(100 * won / (won + lostN + expN)) : null, due = open.filter(r => r.follow_up && r.follow_up <= today).length;
  const val = open.reduce((s, r) => s + docTotals(r).total, 0);
  let showAll = false;
  const draw = () => { const list = showAll ? all : open;
    $("#qtb").innerHTML = list.map((r, i) => `<tr><td><b>${esc(docNo(r))}</b>${qTag(r)}</td><td>${esc(r.customer)}${r.lpo_no ? `<br><small>LPO ${esc(r.lpo_no)}</small>` : ""}</td><td class="n">${kes(docTotals(r).total)}</td><td class="n">${ageOf(r)} d</td><td>${esc(r.valid_until || "")}</td>
      <td>${qState(r) === "Sent" ? (r.follow_up ? `${r.follow_up <= today ? `<span class="tag bad">${esc(r.follow_up)}</span>` : esc(r.follow_up)}` : "—") : esc(r.outcome_note || "")}</td>
      <td class="acts">${can("docs.issue") ? `<button class="btn sm" data-qs="${i}">Status</button>` : ""} ${can("docs.add") && qState(r) !== "Accepted" ? `<button class="btn sm ghost" data-cv="${i}">Convert to invoice</button>` : ""} <button class="btn sm pbtn" data-p="${i}">Print</button></td></tr>`).join("") || `<tr><td colspan="7">${showAll ? "No quotations yet." : "No open quotations. Quotations you issue appear here until they are accepted, lost or expire."}</td></tr>`;
    $("#qtb").onclick = async e => { const b = e.target.closest("button"); if (!b) return; const D = b.dataset, row = k => list[D[k]];
      if (D.qs) quoteDialog(row("qs"), quotesPage); else if (D.p) printCard("document", row("p"));
      else if (D.cv) { const x = await db.rpc("doc_convert_quote", { p_id: row("cv").id }); if (x.error) return toast(x.error.message); toast("Draft invoice " + x.data.doc_no + " created. Open it under Quotes / Invoices / Receipts."); quotesPage(); } }; };
  $("#view").innerHTML = `<h2>Open quotations</h2><div class="cards"><div class="card"><small>Open quotations</small><b>${open.length}</b></div><div class="card"><small>Value waiting</small><b>KES ${kes(val)}</b></div><div class="card"><small>To follow up now</small><b>${due}</b></div><div class="card"><small>Win rate, last 12 months</small><b>${rate == null ? "—" : rate + "%"}</b>${rate == null ? "" : `<small>${won} won · ${lostN} lost · ${expN} expired</small>`}</div></div>
    <p style="color:var(--mut)">A quotation is <b>open</b> from the day you issue it until you mark it accepted or lost, or its “valid until” date passes (30 days by default). Win rate counts quotations made in this app.</p>
    <div class="bar"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="qall" style="width:auto"> Show accepted, lost and expired too</label></div>
    <div class="wrap"><table><thead><tr><th>Quotation</th><th>Customer</th><th>Value (KES)</th><th>Age</th><th>Valid until</th><th>Follow up</th><th></th></tr></thead><tbody id="qtb"></tbody></table></div>`;
  draw(); $("#qall").onchange = e => { showAll = e.target.checked; draw(); };
}
// monthly charges that post themselves to a credit account
async function recurringDialog() {
  const accts = accounts.filter(a => a.active), f = $("#dlgForm"), edit = can("accounts.edit");
  const rows = must(await db.from("recurring_charges").select("*").order("id")) || [], posts = must(await db.from("recurring_posts").select("charge_id")) || [];
  const n = {}; posts.forEach(p => n[p.charge_id] = (n[p.charge_id] || 0) + 1);
  f.innerHTML = `<h2>Monthly charges</h2><p style="margin-top:0">Posted to the account by itself on the chosen day each month (internet, maintenance contracts…). They appear on the account statement and in the month-end SMS balance.</p>
    <table><thead><tr><th>Account</th><th>What</th><th>KES / month</th><th>Day</th><th>From</th><th>Until</th><th></th></tr></thead><tbody>${rows.map(r => `<tr class="${r.active ? "" : "low"}"><td>${esc(acctName(r.account_id))}</td><td>${esc(r.description)}</td><td class="n">${kes(r.amount)}</td><td>${r.day_of_month}</td><td>${esc(r.start_date)}</td><td>${esc(r.end_date || "")}</td>
      <td>${edit ? `<button type="button" class="btn sm ghost" data-tg="${r.id}">${r.active ? "Switch off" : "Switch on"}</button>${n[r.id] ? "" : ` <button type="button" class="btn sm warn" data-rm="${r.id}">Delete</button>`}` : ""}</td></tr>`).join("") || `<tr><td colspan="7">None yet.</td></tr>`}</tbody></table>
    ${edit ? `<h3>Add a monthly charge</h3><div class="grid"><label>Account<select name="ac" required><option value=""></option>${accts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label><label>What for<input name="ds" maxlength="160" placeholder="Internet 10 Mbps" required autocomplete="off"></label>
      <label>Amount per month (KES)<input name="am" type="number" min="1" step="any" required></label><label>Post on day (1 to 28)<input name="dy" type="number" min="1" max="28" value="1" required></label>
      <label>Starting<input name="sd" type="date" value="${iso(new Date())}" required></label><label>Until (optional)<input name="ed" type="date"></label></div>` : ""}
    <div class="bar" style="margin-top:14px">${edit ? `<button class="btn" value="add">Add</button>` : ""}<button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
  f.oninput = null; f.onchange = null;
  f.onclick = async e => { const b = e.target.closest("button[data-tg],button[data-rm]"); if (!b) return;
    const r = b.dataset.tg ? await db.from("recurring_charges").update({ active: !rows.find(x => String(x.id) === b.dataset.tg).active }).eq("id", Number(b.dataset.tg)) : (confirm("Delete this monthly charge?") ? await db.from("recurring_charges").delete().eq("id", Number(b.dataset.rm)) : null);
    if (r) { if (r.error) return toast(r.error.message); recurringDialog(); } };
  f.onsubmit = async e => { if (e.submitter.value !== "add") return; e.preventDefault(); const el = f.elements;
    const r = await db.from("recurring_charges").insert({ account_id: Number(el.ac.value), description: el.ds.value.trim(), amount: Number(el.am.value), day_of_month: Number(el.dy.value), start_date: el.sd.value, end_date: el.ed.value || null });
    if (r.error) return toast(r.error.message);
    const x = await db.rpc("recurring_run", {}); toast(x.error ? "Saved" : x.data.posted ? `Saved. ${x.data.posted} charge(s) posted now.` : "Saved. It will post on the chosen day."); await recurringDialog(); };
  $("#dlg").showModal();
}
// buying costs and expected margin. Kept in their own table, so they can never reach a customer's document.
async function marginDialog(kind, rec) {
  const f = $("#dlgForm"), doc = kind === "document", id = rec.id;
  const m = (await db.from("margin_costs").select("*").eq("kind", kind).eq("ref_id", id)).data, saved = (Array.isArray(m) ? m[0] : m) || {};
  const sr = await db.from("v_stock").select("description,unit_cost"), stock = ((sr.error ? [] : sr.data) || []).filter(s => s.description);
  const nk = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""), find = desc => { const k = nk(desc); if (k.length < 3) return null; return stock.find(s => nk(s.description) === k) || stock.find(s => nk(s.description).length >= 5 && (k.includes(nk(s.description)) || nk(s.description).includes(k))) || null; };
  const lines = doc ? (rec.items || []).filter(i => String(i.desc || "").trim()).map((i, n) => { const sv = (saved.lines || [])[n], hit = find(i.desc); return { desc: i.desc, qty: Number(i.qty) || 0, price: Number(i.price) || 0, cost: sv && nk(sv.desc) === nk(i.desc) ? sv.cost : hit && hit.unit_cost != null ? Number(hit.unit_cost) : "", fromStock: !(sv && nk(sv.desc) === nk(i.desc)) && !!(hit && hit.unit_cost != null) }; })
    : ((saved.lines || []).length ? saved.lines.map(l => ({ ...l })) : [{ desc: "", qty: 1, cost: "" }]);
  const revenue = () => doc ? lines.reduce((s, l) => s + l.qty * l.price, 0) - Number(rec.discount || 0) : Number(rec.contract_price || 0);
  const paint = () => { const mat = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.cost) || 0), 0), oth = ["labour", "transport", "lodging"].reduce((s, k) => s + (Number(f.elements[k].value) || 0), 0), rev = revenue(), cost = mat + oth, mg = rev - cost;
    $("#mgsum").innerHTML = `Selling price <b>KES ${kes(rev)}</b> − costs <b>KES ${kes(cost)}</b> (items ${kes(mat)}, other ${kes(oth)}) = margin <b style="color:${mg < 0 ? "#b42318" : "#067647"}">KES ${kes(mg)}${rev > 0 ? " (" + Math.round(100 * mg / rev) + "%)" : ""}</b>`;
    const miss = doc ? lines.filter(l => l.cost === "" || l.cost == null).length : 0; $("#mgmiss").textContent = miss ? `${miss} line(s) have no cost yet, so the margin shown is higher than it really is.` : ""; };
  const draw = () => { f.innerHTML = `<h2>Margin – ${esc(doc ? docNo(rec) : rec.job_no)}</h2><p style="margin-top:0">${esc(doc ? rec.customer : rec.client_name)}. Only people who may see buying costs can open this. It is never printed or sent to the customer.</p>
    <table><thead><tr><th>Item</th><th>Qty</th>${doc ? "<th>Sells at</th>" : ""}<th>Buying cost each</th><th></th></tr></thead><tbody>${lines.map((l, i) => `<tr><td>${doc ? esc(l.desc) : `<input data-i="${i}" data-k="desc" list="mgdl" value="${esc(l.desc)}" placeholder="Item or material" autocomplete="off">`}</td><td>${doc ? l.qty : `<input data-i="${i}" data-k="qty" type="number" min="0" step="any" value="${l.qty}" style="width:70px">`}</td>${doc ? `<td class="n">${kes(l.price)}</td>` : ""}
      <td><input data-i="${i}" data-k="cost" type="number" min="0" step="any" value="${l.cost}" style="width:110px">${l.fromStock ? ` <small title="Taken from the stock cost">stock</small>` : ""}</td><td>${doc ? "" : `<button type="button" class="btn sm ghost" data-rm="${i}">✕</button>`}</td></tr>`).join("")}</tbody></table>
    <datalist id="mgdl">${stock.map(s => `<option value="${esc(s.description)}">`).join("")}</datalist>${doc ? "" : `<button type="button" class="btn sm ghost" id="mgadd">+ line</button>`}
    <div class="grid" style="margin-top:10px"><label>Labour (KES)<input name="labour" type="number" min="0" step="any" value="${Number(saved.labour || 0)}"></label><label>Transport (KES)<input name="transport" type="number" min="0" step="any" value="${Number(saved.transport || 0)}"></label><label>Food and lodging (KES)<input name="lodging" type="number" min="0" step="any" value="${Number(saved.lodging || 0)}"></label></div>
    <p id="mgsum" class="box" style="margin:12px 0 4px"></p><p id="mgmiss" style="color:#b54708;margin:0"></p>
    <div class="bar" style="margin-top:12px"><button class="btn" value="save">Save</button><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`; paint(); };
  draw();
  f.oninput = e => { const t = e.target; if (t.dataset.k) { const l = lines[t.dataset.i]; l[t.dataset.k] = t.dataset.k === "desc" ? t.value : (t.value === "" ? "" : Number(t.value)); if (t.dataset.k === "desc" && !doc && (l.cost === "" || l.cost == null)) { const h = find(t.value); if (h && h.unit_cost != null) { l.cost = Number(h.unit_cost); const ci = f.querySelector(`[data-i="${t.dataset.i}"][data-k="cost"]`); if (ci) ci.value = l.cost; } } if (t.dataset.k === "cost") l.fromStock = false; } paint(); };
  f.onchange = null;
  f.onclick = e => { if (e.target.id === "mgadd") { lines.push({ desc: "", qty: 1, cost: "" }); draw(); } if (e.target.dataset.rm != null && !doc) { lines.splice(e.target.dataset.rm, 1); if (!lines.length) lines.push({ desc: "", qty: 1, cost: "" }); draw(); } };
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const el = f.elements;
    const r = await db.from("margin_costs").upsert({ kind, ref_id: id, lines: lines.filter(l => doc || String(l.desc || "").trim()).map(l => ({ desc: l.desc, qty: l.qty, cost: l.cost === "" ? null : Number(l.cost) })), labour: Number(el.labour.value) || 0, transport: Number(el.transport.value) || 0, lodging: Number(el.lodging.value) || 0, updated_at: new Date().toISOString() });
    if (r.error) return toast(r.error.message); $("#dlg").close(); toast("Costs saved"); };
  $("#dlg").showModal();
}
function docPrintHtml(r) {
  const t = docTotals(r), ty = r.doc_type, dn = ty === "Delivery note", cn = ty === "Credit note", st = docSt(r), no = docNo(r) + ((r.revision || 1) > 1 ? " (revision " + r.revision + ")" : "");
  const banner = r._old ? `<p class="box"><b>EARLIER VERSION</b> – replaced by a later revision</p>` : isImp(r) ? `<p class="box"><b>Imported record</b> of the original document ${esc(r.doc_no)}${st === "Void" ? ". Marked void: " + esc(r.void_reason || "") : ""}</p>` : st === "Draft" && "status" in r ? `<p class="box"><b>DRAFT</b> – not issued</p>` : st === "Void" ? `<p class="box"><b>VOID</b>${r.void_reason ? " – " + esc(r.void_reason) : ""}</p>` : "";
  const info = [["Customer", r.customer], ["Customer KRA PIN", r.customer_pin], ["Contact", r.contact], ["Address / site", r.address], ["Reference", r.reference], ["Client LPO / PO no.", r.lpo_no], ["Date", r.doc_date || "undated"],
    ...(ty === "Quotation" ? [["Valid until", r.valid_until]] : []),
    ...(["Invoice", "Credit note"].includes(ty) ? [["eTIMS invoice no.", r.etims_no], ["eTIMS date", r.etims_date]] : [])].filter(([, v]) => v);
  const rows = dn ? r.items.map(i => `<tr><td>${esc(i.desc)}</td><td>${i.ordered}</td><td>${i.prior}</td><td>${i.delivered}</td><td>${Number(i.ordered) - Number(i.prior) - Number(i.delivered)}</td></tr>`).join("")
    : r.items.map(i => `<tr><td>${esc(i.desc)}</td><td>${i.qty}</td><td>${kes(i.price)}</td><td>${kes(i.qty * i.price)}</td></tr>`).join("");
  const head_ = dn ? `<th>Description</th><th>Ordered</th><th>Delivered before</th><th>Delivered now</th><th>Outstanding</th>` : `<th>Description</th><th>Qty</th><th>Unit price</th><th>Amount (KES)</th>`;
  const sum_ = dn ? "" : t.stated ? `${r.items.length ? `<tr><td colspan="3" align="right">Total of the line items found</td><td>${kes(t.lines)}</td></tr>` : ""}<tr><th colspan="3" align="right">TOTAL AS SHOWN ON THE ORIGINAL (KES)</th><th>${kes(t.total)}</th></tr>`
    : `<tr><td colspan="3" align="right">Subtotal</td><td>${kes(t.sub)}</td></tr>${Number(r.discount) > 0 ? `<tr><td colspan="3" align="right">Discount</td><td>${kes(r.discount)}</td></tr>` : ""}${Number(r.vat_rate) > 0 ? `<tr><td colspan="3" align="right">VAT (${r.vat_rate}%)</td><td>${kes(t.vat)}</td></tr>` : ""}
      <tr><th colspan="3" align="right">${cn ? "TOTAL CREDITED (KES)" : "TOTAL (KES)"}</th><th>${kes(t.total)}</th></tr>${["Invoice", "Receipt"].includes(ty) ? `<tr><td colspan="3" align="right">Paid to date</td><td>${kes(r.paid_before)}</td></tr><tr><th colspan="3" align="right">BALANCE (KES)</th><th>${kes(t.balance)}</th></tr>` : ""}`;
  const foot = dn ? `<p>Goods received in good order and condition.</p><p>Delivered by: ______________________ &nbsp; Received by (name, signature, date): ______________________</p>`
    : `<p>${ty === "Quotation" ? "Prices in KES. Goods remain the property of Franksomi Solution Ltd until paid in full." : cn ? "This credit note cancels the invoice named above." : "Thank you for your business."}</p>`;
  return head(ty.toUpperCase(), no) + banner + kv(info) + `<table style="margin-top:10px"><thead><tr>${head_}</tr></thead><tbody>${rows}${sum_}</tbody></table>` + foot;
}

// ---- printable cards ----------------------------------------------------------
const head = (title, no) => `<h1><span><img src="logo.png" alt="" height="30" style="vertical-align:middle;margin-right:8px;background:#fff;border-radius:4px;padding:2px">${SHOP.name.toUpperCase()}</span><span>${title}</span></h1><p>Repairs · Sales · Installations | ${SHOP.place} | Tel: ${SHOP.phone} | ${SHOP.email}${no ? ` | <b>${esc(no)}</b>` : ""}</p>`;
const kv = (a) => `<table>${a.map(([k, v]) => `<tr><th style="width:30%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`;
async function repairChecks(id) {
  const r = await db.from("repair_checks").select("*").eq("repair_id", id).limit(1);
  const x = (r.data && (Array.isArray(r.data) ? r.data[0] : r.data)) || {};
  const c = await db.from("repair_contacts").select("*").eq("repair_id", id).limit(1);
  const y = (c.data && (Array.isArray(c.data) ? c.data[0] : c.data)) || {};
  return { left_with: x.left_with || [], condition: x.condition || [], alt_name: y.alt_name || null, alt_phone: y.alt_phone || null };
}
const tickLine = (all, have) => all.map(x => `${have.includes(x) ? "[✔]" : "[ ]"} ${esc(x)}`).join(" &nbsp;");
function printCard(kind, r) {
  let h = "";
  if (kind === "jobcard") h = head("JOB CARD", "JC-" + String(r.id).padStart(4, "0")) + kv([["Customer", r.customer_name], ["Contact", r.contact], ...(r.alt_phone || r.alt_name ? [["Alternative contact", [r.alt_name, r.alt_phone].filter(Boolean).join(" – ")]] : []), ["Date received", r.received_on], ["Item", [r.item_type, r.brand_model].filter(Boolean).join(" – ")], ["Serial / IMEI", r.serial_no], ["Fault reported", r.fault],
    ["Diagnosis", r.diagnosis], ...((r.items && r.items.length) || r.part1_name || r.part2_name ? [["Parts and items", [r.part1_name && `${r.part1_name} × ${r.part1_qty ?? 1}`, r.part2_name && `${r.part2_name} × ${r.part2_qty ?? 1}`, ...(r.items || []).map(i => `${i.description} × ${i.qty}`)].filter(Boolean).join("; ")]] : []), ["Parts (KES)", kes(r.parts_cost)], ["Labor (KES)", kes(r.labor_cost)], ["Estimated total (KES)", kes(r.total_cost)], ["Refundable deposit (KES)", kes(r.deposit_received)]]) +
    `<div class="box">Left with device: ${tickLine(LEFT_WITH, r.left_with || [])}<br>Condition: ${tickLine(CONDITION, r.condition || [])}</div>
     <div class="box"><b>Terms</b><br>1. Bring this card when collecting your device.<br>2. The estimate may change after full diagnosis; we will contact you first.<br>3. Please back up your data; we are not responsible for data lost during repair.<br>4. Devices not collected within 30 days of being notified may be charged a storage fee.<br>5. 30-day warranty on the replaced part only. Excludes physical or water damage.<br>6. A deposit is deducted from your final bill or refunded.</div>
     <p><b>Track your repair online:</b> ${esc(portalUrl("JC-" + String(r.id).padStart(4, "0")))} &nbsp;(Job card <b>JC-${String(r.id).padStart(4, "0")}</b> + the phone number you gave us)</p>
     <p>Customer signature: ______________________ &nbsp; Received by: ______________________</p>
     <p style="text-align:center;color:#555">✂ - - - - - - - - - - - - - tear off here - - - - - - - - - - - - -</p>
     <div class="box"><img src="logo.png" alt="" height="22" style="vertical-align:middle;margin-right:6px"><b>CUSTOMER RECEIPT — ${SHOP.name}</b> &nbsp; Job Card No: <b>JC-${String(r.id).padStart(4, "0")}</b><br>Customer: ${esc(r.customer_name)} &nbsp; Date received: ${esc(r.received_on)}<br>
     Item: ${esc([r.item_type, r.brand_model].filter(Boolean).join(" – "))} &nbsp; Serial / IMEI: ${esc(r.serial_no)}<br>Fault: ${esc(r.fault)}<br>Refundable deposit: <b>KES ${kes(r.deposit_received)}</b> &nbsp; Received by: ____________<br>
     <small>Keep this slip and bring it when collecting your device.</small></div>`;
  if (kind === "fieldcard") h = head("FIELD JOB CARD", r.job_no) + kv([["Client", r.client_name], ["Contact", r.contact], ["Site / location", r.site], ["Job type", r.job_type], ["Date started", r.started_on], ["Scope of work", r.scope],
    ["Contract price (KES)", kes(r.contract_price)], ["Paid so far (KES)", kes(r.paid)], ["Balance due (KES)", kes(r.balance)]]) +
    `<div class="box">Site survey: Cameras ___ DVR/NVR [ ] Hard disk ___ TB | Points ___ DB/breaker [ ] Earthing [ ]<br>Materials / equipment: <br><br><br>Technician(s): __________ Vehicle / transport: __________</div>
     <p><b>Track your job online:</b> ${esc(portalUrl(r.job_no))} &nbsp;(Job No <b>${esc(r.job_no)}</b> + the phone number you gave us)</p>
     <div class="box"><b>Terms</b><br>1. The price covers the scope above; extra work is quoted first.<br>2. A deposit is required before materials are bought; balance due on completion.<br>3. Client provides safe access, power and permissions.<br>4. 30-day workmanship warranty; excludes misuse, power surges, tampering and theft.</div>
     <p>Client signature / date: ______________________ &nbsp; Technician: ______________________</p>
     <p style="text-align:center;color:#555">✂ - - - - - - - - - - - - - tear off here - - - - - - - - - - - - -</p>
     <div class="box"><img src="logo.png" alt="" height="22" style="vertical-align:middle;margin-right:6px"><b>CLIENT RECEIPT — ${SHOP.name}</b> &nbsp; Job No: <b>${esc(r.job_no)}</b><br>Client: ${esc(r.client_name)} &nbsp; Job type: ${esc(r.job_type)}<br>Site: ${esc(r.site)} &nbsp; Contract price: KES ${kes(r.contract_price)}<br>
     Deposit received (KES): ____________ &nbsp; Received by: ____________<br><small>Keep this slip. It confirms your booking and any deposit paid.</small></div>`;
  if (kind === "document") { printHtml(docPrintHtml(r), docNo(r) + " " + r.doc_type + ".pdf"); return; }
  const fname = kind === "jobcard" ? "JC-" + String(r.id).padStart(4, "0") + " Job Card.pdf" : kind === "fieldcard" ? r.job_no + " Field Job Card.pdf" : docNo(r) + " " + r.doc_type + ".pdf";
  printHtml(h, fname);
}


// ---- shared helpers for reports -------------------------------------------------
// Opens the document in a NEW TAB (print.html) with Print and Download PDF buttons. If the browser blocks the new tab, it is shown on this page instead.
function printHtml(html, filename = "Franksomi document.pdf") {
  const body = `<div id="docbody">${html}<div class="docfoot"><img src="logo.png" alt="" height="26"><b>${BRAND.TAGLINE}</b><span>${SHOP.name} · ${SHOP.phone} · ${SHOP.email}</span></div><div class="doccopy">© ${new Date().getFullYear()} ${SHOP.name}. All rights reserved.</div></div>`;
  let tab = null;
  try { localStorage.setItem("fk_print", JSON.stringify({ html: body, filename })); tab = window.open("print.html", "_blank"); } catch (_) { tab = null; }
  if (tab) return;
  try { localStorage.removeItem("fk_print"); } catch (_) {}
  toast("Your browser blocked the new tab, so the document is shown here. Allow pop-ups for this site to open it in a new tab.");
  const p = $("#print"); p.innerHTML = `<div class="doc"><div class="noprint doctools"><button class="btn pbtn" data-act="print">Print</button> <button class="btn pdfbtn" data-act="pdf">Download PDF</button>
    <button class="btn ghost" data-act="close">Close</button><span id="pdfmsg"></span></div>${body}</div>`;
  $("#app").hidden = true; p.hidden = false; window.scrollTo(0, 0);
  p.onclick = async e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    if (b.dataset.act === "print") window.print();
    if (b.dataset.act === "close") { p.hidden = true; $("#app").hidden = false; }
    if (b.dataset.act === "pdf") {
      const m = $("#pdfmsg"); b.disabled = true; m.textContent = "Making the PDF…";
      try { await PDF.download($("#docbody"), filename); m.textContent = "PDF saved: " + filename; }
      catch (err) { console.error(err); m.textContent = "This browser could not make the PDF directly. In the Print window choose “Save as PDF”."; window.print(); }
      b.disabled = false;
    }
  };
}
const today = () => new Date().toISOString().slice(0, 10);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const tbl = (head, rows, foot) => `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? "n" : ""}">${typeof c === "number" ? kes(c) : esc(c)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${head.length}">None</td></tr>`}</tbody>${foot ? `<tfoot><tr>${foot.map((c, i) => `<th class="${i ? "n" : ""}" style="background:var(--navy)">${typeof c === "number" ? kes(c) : esc(c)}</th>`).join("")}</tr></tfoot>` : ""}</table>`;
const sumBy = (rows, f = r => r.total) => rows.reduce((s, r) => s + Number(f(r) || 0), 0);
const payCards = (obj) => ["Cash", "M-Pesa", "Bank"].concat(obj["Deposit applied"] ? ["Deposit applied"] : []).map(k => `<div class="card"><small>${k}</small><b>KES ${kes(obj[k] || 0)}</b></div>`).join("");

// ---- end of day -------------------------------------------------------------------
async function eodPage() {
  const day = sessionStorage.getItem("eodDay") || today();
  const r = must(await db.rpc("day_report", { d: day }));
  const sal = r.sales || [], svc = r.services || [], inc = r.income || [], exp = r.expenses || [], dep = r.deposits || [], dap = r.deposits_applied || [];
  const by = (arr, f) => { const o = {}; arr.forEach(x => { const p = x.payment || "Cash"; o[p] = (o[p] || 0) + Number(f(x) || 0); }); return o; };
  const merge = (...os) => { const o = {}; os.forEach(x => Object.entries(x).forEach(([k, v]) => o[k] = (o[k] || 0) + v)); return o; };
  const takings = merge(by(sal, x => x.total), by(svc, x => x.total), by(inc, x => x.amount));
  const totalIn = sumBy(sal) + sumBy(svc) + sumBy(inc, x => x.amount), totalOut = sumBy(exp, x => x.amount);
  const cl = r.closing;
  const body = `<h2 style="margin-top:0">End-of-day report — ${esc(day)}</h2><p><small>${esc(r.scope)}</small></p>
    <div class="cards">${payCards(takings)}<div class="card"><small>Total taken</small><b>KES ${kes(totalIn)}</b></div><div class="card"><small>Expenses paid</small><b>KES ${kes(totalOut)}</b></div>
    <div class="card"><small>Refundable deposits taken</small><b>KES ${kes(sumBy(dep, x => x.amount))}</b></div><div class="card"><small>Deposits applied to bills (income, no new cash)</small><b>KES ${kes(sumBy(dap, x => x.amount))}</b></div></div>
    <p>Repairs received: <b>${r.repairs_in}</b> · returned: <b>${r.repairs_out}</b> · jobs started: <b>${r.jobs_started}</b> · jobs completed: <b>${r.jobs_done}</b></p>
    <h3>Shop sales</h3>${tbl(["Item", "Qty", "Total", "Payment"], sal.map(x => [x.item, x.qty, x.total, x.payment || ""]), ["Total", "", sumBy(sal), ""])}
    <h3>Printing & Cyber</h3>${tbl(["Service", "Qty", "Total", "Payment"], svc.map(x => [x.service, x.qty, x.total, x.payment || ""]), ["Total", "", sumBy(svc), ""])}
    <h3>Repair / installation payments</h3>${tbl(["Customer / Job", "Description", "Amount", "Payment"], inc.map(x => [x.ref || "", x.description || "", x.amount, x.payment || ""]), ["Total", "", sumBy(inc, x => x.amount), ""])}
    <h3>Deposits taken</h3>${tbl(["Customer", "Amount", "Paid by"], dep.map(x => [x.customer, x.amount, x.payment || "Cash"]))}
    <h3>Deposits applied to bills</h3>${tbl(["Customer", "Job card", "Amount"], dap.map(x => [x.customer, x.ref, x.amount]), ["Total", "", sumBy(dap, x => x.amount)])}<p style="color:var(--mut);font-size:13px">A deposit applied to a bill counts as income today. The cash was already counted on the day the deposit was taken, so it does not change expected cash.</p>
    <h3>Expenses</h3>${tbl(["Description", "Category", "Amount", "Payment"], exp.map(x => [x.description || "", x.category || "", x.amount, x.payment || ""]), ["Total", "", totalOut, ""])}
    ${r.owner ? `<h3>Profit on shop sales today</h3><p>KES ${kes(sumBy(sal, x => x.profit))}</p>` : ""}
    <h3>Cash drawer</h3><p>Cash in (sales, services, payments, deposits): <b>${kes(r.cash_in)}</b> − cash expenses: <b>${kes(r.cash_out)}</b> = expected cash <b>KES ${kes(r.expected_cash)}</b></p>
    ${cl ? `<p>Closed: counted <b>${kes(cl.counted_cash)}</b> · difference <b>${kes(cl.variance)}</b> ${cl.note ? "· " + esc(cl.note) : ""}</p>` : ""}`;
  const xtra = await eodExtras(day);
  $("#view").innerHTML = `<h2>End of day</h2><div class="bar"><label>Day <input type="date" id="eday" value="${day}"></label><button class="btn pbtn" id="eprint">Print report</button></div>${xtra}<div class="card" style="overflow:auto">${body}</div>
    ${cl ? "" : `<div class="card" style="margin-top:12px"><b style="font-size:16px">Close the day</b><div class="grid" style="margin-top:8px"><label>Cash counted in drawer (KES)<input id="counted" type="number" min="0" step="any" inputmode="decimal"></label>
      <label>Note<input id="cnote" placeholder="Reason for any difference"></label></div><p id="cdiff" style="color:var(--mut)">Expected cash: KES ${kes(r.expected_cash)}</p><button class="btn" id="close">Save closing</button></div>`}`;
  $("#eday").onchange = e => { sessionStorage.setItem("eodDay", e.target.value); route(); };
  $("#eprint").onclick = () => printHtml(head("END OF DAY REPORT", day) + body, "End of day " + day + ".pdf");
  if (!cl) {
    $("#counted").oninput = e => { const v = Number(e.target.value) - Number(r.expected_cash); $("#cdiff").textContent = `Expected cash: KES ${kes(r.expected_cash)} · difference: ${v >= 0 ? "+" : ""}${kes(v)}`; };
    $("#close").onclick = async () => { const c = $("#counted").value; if (c === "") return toast("Type the cash counted first.");
      const x = await db.from("day_closings").insert({ day, expected_cash: r.expected_cash, counted_cash: Number(c), note: $("#cnote").value || null }); if (x.error) return toast(x.error.message); toast("Day closed"); route(); };
  }
}

// ---- monthly report (owner) ----------------------------------------------------------------
async function monthlyPage() {
  const now = new Date(), yr = Number(sessionStorage.getItem("mYr")) || now.getFullYear(), mo = Number(sessionStorage.getItem("mMo")) || now.getMonth() + 1;
  const r = must(await db.rpc("monthly_report", { yr, mon: mo }));
  const days = (r.days || []).filter(d => d.services || d.retail || d.printing_cyber || d.expenses);
  const tot = k => sumBy(r.days || [], d => d[k]);
  const body = `<h2 style="margin-top:0">Monthly report — ${MONTHS[mo - 1]} ${yr}</h2>
    <div class="cards"><div class="card"><small>Total income</small><b>KES ${kes(tot("services") + tot("retail") + tot("printing_cyber"))}</b></div><div class="card"><small>Expenses</small><b>KES ${kes(tot("expenses"))}</b></div>
    <div class="card"><small>Cash profit</small><b>KES ${kes(tot("services") + tot("retail") + tot("printing_cyber") - tot("expenses"))}</b></div><div class="card"><small>Deposits taken (held for customers)</small><b>KES ${kes(r.deposits_taken)}</b></div></div>
    <p>Money by payment method:</p><div class="cards">${payCards(r.payments || {})}</div>
    <p>Repairs received: <b>${r.repairs_in}</b> · returned: <b>${r.repairs_out}</b> · jobs started: <b>${r.jobs_started}</b> · completed: <b>${r.jobs_done}</b></p>
    <h3>Day by day</h3>${tbl(["Day", "Repairs & installs", "Shop sales", "Printing & Cyber", "Expenses"], days.map(d => [d.d, d.services, d.retail, d.printing_cyber, d.expenses]), ["Total", tot("services"), tot("retail"), tot("printing_cyber"), tot("expenses")])}
    <h3>Top selling items</h3>${tbl(["Item", "Qty", "Sales", "Profit"], (r.top_items || []).map(x => [x.item, x.qty, x.sales, x.profit]))}
    <h3>Printing & Cyber by service</h3>${tbl(["Service", "Qty", "Total"], (r.service_breakdown || []).map(x => [x.service, x.qty, x.total]))}
    <h3>Expenses by category</h3>${tbl(["Category", "Amount"], (r.expense_by_category || []).map(x => [x.category, x.amount]))}
    ${(() => { const ec = r.expense_by_category || [], sm = f => ec.filter(f).reduce((t, x) => t + Number(x.amount), 0), mk = sm(x => /^Marketing/i.test(x.category || "")), sp = sm(x => Object.values(PAYKINDS).includes(x.category)); return mk || sp ? `<p style="color:var(--mut)">${mk ? `Marketing spend: <b>KES ${kes(mk)}</b>. ` : ""}${sp ? `Staff pay (salaries, wages, commissions, advances): <b>KES ${kes(sp)}</b>.` : ""}</p>` : ""; })()}
    <h3>Daily cash closings</h3>${tbl(["Day", "Expected", "Counted", "Difference"], (r.closings || []).map(x => [x.day, x.expected, x.counted, x.variance]))}`;
  const mx = await monthExtras(yr, mo);
  $("#view").innerHTML = `<h2>Monthly report</h2><div class="bar"><label>Month <select id="mm">${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === mo ? "selected" : ""}>${m}</option>`).join("")}</select></label>
    <label>Year <input id="my" type="number" value="${yr}" style="width:100px"></label><button class="btn pbtn" id="mp">Print report</button></div><div class="card" style="overflow:auto">${mx.html}</div><div class="card" style="overflow:auto;margin-top:12px">${body}</div>`;
  $("#mm").onchange = e => { sessionStorage.setItem("mMo", e.target.value); route(); }; $("#my").onchange = e => { sessionStorage.setItem("mYr", e.target.value); route(); };
  $("#mp").onclick = () => printHtml(head("MONTHLY REPORT", MONTHS[mo - 1] + " " + yr) + body + mx.print, "Monthly report " + yr + "-" + String(mo).padStart(2, "0") + ".pdf");
}

// ---- year summary (owner) ----------------------------------------------------------------
async function summaryPage() {
  const yr = Number(sessionStorage.getItem("yr")) || new Date().getFullYear();
  const r = must(await db.rpc("summary_report", { yr }));
  const M = r.months, tt = k => sumBy(M, m => m[k]), L = r.lines || {}, rt = r.retail, j = r.jobs, rp = r.repairs, iv = r.inventory, tr = r.transport;
  const margin = rt.sales ? (100 * (rt.sales - rt.cogs) / rt.sales).toFixed(1) + "%" : "0.0%";
  const body = `<h2 style="margin-top:0">Summary — ${yr}</h2>
    <h3>Month by month</h3>${tbl(["Month", "Repairs & installs", "Shop sales", "Printing & Cyber", "Landlord WiFi", "Total income", "Expenses", "Cash profit", "Cash in", "M-Pesa in", "Bank in"],
      M.map(m => [MONTHS[m.m - 1], m.services_income, m.retail, m.printing_cyber, m.wifi || 0, m.total_income, m.expenses, m.profit, m.cash_in, m.mpesa_in, m.bank_in]),
      ["Year total", tt("services_income"), tt("retail"), tt("printing_cyber"), tt("wifi"), tt("total_income"), tt("expenses"), tt("profit"), tt("cash_in"), tt("mpesa_in"), tt("bank_in")])}
    <h3>Income by business line</h3>${tbl(["Line", "Amount"], [["Repairs", L["Repair"] || 0], ["Electrical installations", L["Electrical installation"] || 0], ["CCTV installations", L["CCTV installation"] || 0], ["Other services", L["Other service"] || 0],
      ["Retail sales (accessories & electronics)", L["Retail sales"] || 0], ["Printing & Cyber", L["Printing & Cyber"] || 0], ["Landlord WiFi (PPPoE customers)", L["Landlord WiFi"] || 0]], ["Total", tt("total_income")])}
    <h3>Retail margin</h3>${tbl(["", "KES"], [["Sales", rt.sales], ["Cost of goods sold", rt.cogs], ["Gross profit", rt.sales - rt.cogs], ["Margin", margin]])}
    <h3>Field jobs — installations (all time)</h3>${tbl(["", "Value"], [["Jobs recorded", j.count], ["Jobs completed", j.done], ["Contract value", j.contract], ["Collected so far", j.paid], ["Balance owed by clients", j.balance], ["Job costs", j.costs], ["Job profit", j.profit]])}
    <h3>Transport & logistics (year)</h3>${tbl(["", "KES"], [["Transport / Logistics", tr.transport], ["Fuel", tr.fuel], ["Total", tr.transport + tr.fuel]])}
    <h3>Repairs (all time)</h3>${tbl(["", "Value"], [["Items received", rp.received], ["Returned to customers", rp.returned], ["Still in shop", rp.in_shop], ["Parts charged", rp.parts], ["Labor charged", rp.labor], ["Customer deposits held", rp.deposits_held]])}
    <h3>Inventory</h3>${tbl(["", "Value"], [["Stock items", iv.items], ["Stock value at cost", iv.value], ["Items to reorder", iv.reorder]])}`;
  const yx = await yearExtras(yr);
  $("#view").innerHTML = `<h2>Year summary</h2><div class="bar"><label>Year <input id="sy" type="number" value="${yr}" style="width:100px"></label><button class="btn pbtn" id="sp">Print summary</button></div><div class="card" style="overflow:auto">${yx.html}</div><div class="card" style="overflow:auto;margin-top:12px">${body}</div>`;
  $("#sy").onchange = e => { sessionStorage.setItem("yr", e.target.value); route(); };
  $("#sp").onclick = () => printHtml(head("SUMMARY", String(yr)) + body + yx.print, "Year summary " + yr + ".pdf");
}

// ---- M-Pesa reconciliation (owner) ----------------------------------------------------------------
async function mpesaRecords() {
  const g = async (t, cols) => must(await db.from(t).select(cols).limit(5000)) || [];
  const out = [];
  (await g("sales_v", "id,sold_on,total_sales,mpesa_amt,mpesa_ref,payment,item_name")).filter(x => x.payment === "M-Pesa" || x.payment === "Split").forEach(x => out.push({ table: "sales", id: x.id, date: x.sold_on, amount: Number(x.payment === "Split" ? x.mpesa_amt : x.total_sales), ref: x.mpesa_ref, dir: "in", label: "Sale: " + (x.item_name || "") }));
  (await g("services", "id,done_on,total,mpesa_ref,payment,service")).filter(x => x.payment === "M-Pesa").forEach(x => out.push({ table: "services", id: x.id, date: x.done_on, amount: Number(x.total), ref: x.mpesa_ref, dir: "in", label: "Service: " + x.service }));
  (await g("income", "id,received_on,amount,mpesa_ref,payment,description,ref")).filter(x => x.payment === "M-Pesa").forEach(x => out.push({ table: "income", id: x.id, date: x.received_on, amount: Number(x.amount), ref: x.mpesa_ref, dir: "in", label: "Payment: " + (x.description || x.ref || "") }));
  (await g("expenses", "id,spent_on,amount,mpesa_ref,payment,description")).filter(x => x.payment === "M-Pesa").forEach(x => out.push({ table: "expenses", id: x.id, date: x.spent_on, amount: Number(x.amount), ref: x.mpesa_ref, dir: "out", label: "Expense: " + (x.description || "") }));
  (await g("repairs", "id,received_on,deposit_received,deposit_payment,deposit_mpesa_ref,customer_name")).filter(x => x.deposit_payment === "M-Pesa" && x.deposit_received > 0).forEach(x => out.push({ table: "repairs", id: x.id, date: x.received_on, amount: Number(x.deposit_received), ref: x.deposit_mpesa_ref, dir: "in", label: "Deposit: " + x.customer_name }));
  return out;
}
const REFCOL = { sales: "mpesa_ref", services: "mpesa_ref", income: "mpesa_ref", expenses: "mpesa_ref", repairs: "deposit_mpesa_ref" };
async function link(txn, rec) {
  if (!txn.matched_table) { const u = await db.from("mpesa_txns").update({ matched_table: rec.table, matched_id: rec.id }).eq("receipt_no", txn.receipt_no); if (u.error) return toast(u.error.message); }
  if (!rec.ref) { const u = await db.from(rec.table).update({ [REFCOL[rec.table]]: txn.receipt_no }).eq("id", rec.id); if (u.error) return toast(u.error.message); }
}
async function mpesaPage() {
  const txns = must(await db.from("mpesa_txns").select("*").order("txn_time", { ascending: false }).limit(5000)) || [];
  const recs = await mpesaRecords();
  const m = Mpesa.matchAll(txns.map(t => ({ ...t })), recs);
  const hold = txns.filter(t => !t.matched_table).length;
  const sec = (title, n, inner) => `<h3>${title} <span class="tag">${n}</span></h3>${inner}`;
  const tt = t => `${esc((t.txn_time || "").slice(0, 16).replace("T", " "))} · ${esc(t.receipt_no)} · ${esc(t.details)} · <b>${t.paid_in > 0 ? "+" + kes(t.paid_in) : "−" + kes(t.withdrawn)}</b>`;
  $("#view").innerHTML = `<h2>M-Pesa reconciliation</h2>
    <p style="color:var(--mut)">Download your M-Pesa statement as CSV (M-Pesa app, Till / Business portal, or Safaricom statement) and import it. Entries are matched by their M-Pesa code first, then by amount and date. Always type the M-Pesa code when you record an M-Pesa payment.</p>
    <div class="bar"><input type="file" id="csv" accept=".csv,text/csv"><span>${txns.length} statement lines stored · ${hold} not yet matched${m.lo ? " · " + m.lo + " to " + m.hi : ""}</span></div>
    <div class="cards"><div class="card"><small>Statement money in</small><b>KES ${kes(m.stmtIn)}</b></div><div class="card"><small>Statement money out</small><b>KES ${kes(m.stmtOut)}</b></div>
    <div class="card"><small>Recorded M-Pesa in (same period)</small><b>KES ${kes(recs.filter(r => r.dir === "in" && m.lo && r.date >= m.lo && r.date <= m.hi).reduce((s, r) => s + r.amount, 0))}</b></div></div>
    ${sec("Exact matches by M-Pesa code", m.exact.length, m.exact.length ? `<div class="wrap"><table><tbody>${m.exact.map((x, i) => `<tr><td>${tt(x.txn)}</td><td>${esc(x.rec.label)}${x.amountDiffers ? ` <span class="tag bad">amount differs: recorded ${kes(x.rec.amount)}</span>` : ""}</td><td><button class="btn sm" data-ex="${i}">Confirm</button></td></tr>`).join("")}</tbody></table></div><button class="btn sm" id="exall">Confirm all</button>` : "<p>None waiting.</p>")}
    ${sec("Suggested matches (same amount, same day, no code yet)", m.suggested.length, m.suggested.length ? `<div class="wrap"><table><tbody>${m.suggested.map((x, i) => `<tr><td>${tt(x.txn)}</td><td>${esc(x.rec.label)} · ${esc(x.rec.date)}</td><td><button class="btn sm" data-sg="${i}">Confirm</button></td></tr>`).join("")}</tbody></table></div>` : "<p>None.</p>")}
    ${sec("Several possible matches — pick one", m.ambiguous.length, m.ambiguous.map((x, i) => `<div class="card" style="margin-bottom:8px">${tt(x.txn)}<br>${x.options.map((o, k) => `<button class="btn sm ghost" data-am="${i}:${k}">${esc(o.label)} · ${esc(o.date)}</button>`).join(" ")}</div>`).join("") || "<p>None.</p>")}
    ${sec("On the statement but not recorded", m.unrecorded.length, m.unrecorded.length ? `<div class="wrap"><table><tbody>${m.unrecorded.map((t, i) => `<tr><td>${tt(t)}</td><td><button class="btn sm" data-rec="${i}">${t.paid_in > 0 ? "Record as income" : "Record as expense"}</button> <button class="btn sm ghost" data-ign="${i}">Ignore</button></td></tr>`).join("")}</tbody></table></div>` : "<p>None. Everything on the statement is accounted for.</p>")}
    ${sec("Recorded as M-Pesa but not on the statement", m.missing.length, m.missing.length ? `<div class="wrap"><table><tbody>${m.missing.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.label)}</td><td class="n">${r.dir === "in" ? "+" : "−"}${kes(r.amount)}</td><td>${esc(r.ref || "no code")}</td></tr>`).join("")}</tbody></table></div><p style="color:var(--mut)">Check the M-Pesa code or amount typed, or whether the customer actually paid.</p>` : "<p>None.</p>")}`;
  const done = async () => { toast("Saved"); route(); };
  $("#csv").onchange = async e => { const f = e.target.files[0]; if (!f) return;
    try { const rows = Mpesa.parseMpesa(await f.text()); if (!rows.length) return toast("No completed transactions found in that file.");
      const have = new Set(txns.map(t => t.receipt_no)); const fresh = rows.filter(r => !have.has(r.receipt_no));
      if (fresh.length) { const x = await db.from("mpesa_txns").insert(fresh); if (x.error) return toast(x.error.message); }
      toast(`${fresh.length} new lines imported, ${rows.length - fresh.length} already there.`); route(); } catch (err) { toast(err.message); } };
  const v = $("#view");
  v.onclick = async e => { const b = e.target.closest("button"); if (!b) return;
    if (b.id === "exall") { for (const x of m.exact) await link(x.txn, x.rec); return done(); }
    if (b.dataset.ex) { const x = m.exact[b.dataset.ex]; await link(x.txn, x.rec); return done(); }
    if (b.dataset.sg) { const x = m.suggested[b.dataset.sg]; await link(x.txn, x.rec); return done(); }
    if (b.dataset.am) { const [i, k] = b.dataset.am.split(":"); await link(m.ambiguous[i].txn, m.ambiguous[i].options[k]); return done(); }
    if (b.dataset.ign) { const t = m.unrecorded[b.dataset.ign]; const x = await db.from("mpesa_txns").update({ matched_table: "ignored" }).eq("receipt_no", t.receipt_no); return x.error ? toast(x.error.message) : done(); }
    if (b.dataset.rec) { const t = m.unrecorded[b.dataset.rec], day = (t.txn_time || "").slice(0, 10) || today(); let row, tb;
      if (t.paid_in > 0) { tb = "income"; row = { received_on: day, description: t.details, amount: t.paid_in, payment: "M-Pesa", mpesa_ref: t.receipt_no, income_type: "Other service", notes: "From M-Pesa statement — check the type" }; }
      else { tb = "expenses"; row = { spent_on: day, description: t.details, category: "Other", amount: t.withdrawn, payment: "M-Pesa", mpesa_ref: t.receipt_no, notes: "From M-Pesa statement — check the category" }; }
      const x = await db.from(tb).insert(row).select("id"); if (x.error) return toast(x.error.message);
      const id = Array.isArray(x.data) ? x.data[0].id : x.data.id;
      const y = await db.from("mpesa_txns").update({ matched_table: tb, matched_id: id }).eq("receipt_no", t.receipt_no); return y.error ? toast(y.error.message) : done(); } };
}


// ---- M-Pesa checkout (payment prompt to the customer's phone) ---------------------------------
const portalUrl = no => new URL("portal.html", (window.APP_CONFIG && APP_CONFIG.SITE_URL) || location.href).href.split("?")[0] + (no ? "?job=" + encodeURIComponent(no) : "");
async function invokeErr(res) { let msg = "Could not send the payment prompt."; try { const j = res.error && res.error.context ? await res.error.context.json() : res.data; if (j && j.message) msg = j.message; } catch (_) {} return msg; }
function mpayDialog(pre = {}) {
  const f = $("#dlgForm");
  f.innerHTML = `<h2>Request M-Pesa payment</h2><p style="color:var(--mut);margin-top:0">A prompt appears on the customer's phone. They enter their M-Pesa PIN to pay.</p><div class="grid">
    <label>Customer phone<input name="phone" value="${esc(pre.phone || "")}" required inputmode="tel" placeholder="07XX XXX XXX"></label>
    <label id="viaWrap">Take the payment through<select name="provider"><option value="daraja">M-Pesa (Safaricom Daraja)</option><option value="kopokopo" disabled>Kopo Kopo till (checking…)</option></select></label>
    <label>Amount (KES, whole shillings)<input name="amount" type="number" min="1" max="150000" step="1" value="${esc(pre.amount || "")}" required></label>
    <label>For (job card JC-0001, job J-001, or a short note)<input name="ref" value="${esc(pre.ref || "")}" maxlength="20"></label>
    <label>Description<input name="purpose" value="${esc(pre.purpose || "")}" maxlength="60"></label>
    <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="auto" ${pre.auto ? "checked" : ""} style="width:auto"> Record the payment in Income automatically when it succeeds (leave off for shop sales you record yourself)</label></div>
    <p id="mstat" class="msg" style="min-height:1.5em"></p>
    <div class="bar"><button class="btn" value="send" style="background:#12b76a">Send prompt</button><button class="btn ghost" value="cancel" formnovalidate>Close</button></div>`;
  // both services are always listed; one that is not set up yet is greyed out and says so
  const setVia = (ok, def) => { const sel = f.elements.provider; for (const o of sel.options) { const on = ok.includes(o.value); o.disabled = !on; o.textContent = (o.value === "daraja" ? "M-Pesa (Safaricom Daraja)" : "Kopo Kopo till") + (on ? "" : " — not set up yet"); } if (def && ok.includes(def)) sel.value = def; else if (!ok.includes(sel.value) && ok.length) sel.value = ok[0]; };
  setVia(["daraja"], "daraja"); f.elements.provider.options[1].textContent = "Kopo Kopo till (checking…)";
  db.functions.invoke("stk-push", { body: { action: "providers" } }).then(r => { const p = r.data && r.data.providers; setVia(p ? p.map(x => x.id) : ["daraja"], r.data && r.data.default); }).catch(() => setVia(["daraja"], "daraja"));
  f.onsubmit = async e => {
    if (e.submitter.value !== "send") { route(); return; }
    e.preventDefault(); const st = $("#mstat"), btn = e.submitter; btn.disabled = true; st.style.color = ""; st.textContent = "Sending…";
    const res = await db.functions.invoke("stk-push", { body: { phone: f.elements.phone.value, amount: Number(f.elements.amount.value), ref: f.elements.ref.value, purpose: f.elements.purpose.value, auto_record: f.elements.auto.checked, provider: f.elements.provider.value, customer_name: pre.name || "" } });
    if (res.error || !res.data || !res.data.ok) { st.style.color = "#b42318"; st.textContent = await invokeErr(res); btn.disabled = false; return; }
    st.textContent = "Prompt sent. Ask the customer to check their phone and enter their PIN…";
    const id = res.data.public_id;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, window.__POLL_MS__ || 3000));
      if (i === 14) await db.functions.invoke("stk-push", { body: { action: "check", public_id: id } });
      const q = await db.from("mpesa_requests").select("status,mpesa_receipt,result_desc").eq("public_id", id).single(); const s = q.data;
      if (!s) continue;
      if (s.status === "Success") { st.style.color = "#067647"; st.textContent = "Paid ✓ " + (s.mpesa_receipt ? "Receipt " + s.mpesa_receipt : "(receipt number will show on your statement)"); toast("Payment received"); return; }
      if (s.status === "Cancelled" || s.status === "Failed") { st.style.color = "#b42318"; st.textContent = (s.result_desc || "The payment did not go through.") + " You can send again."; btn.disabled = false; return; }
      if (s.status === "Review") { st.style.color = "#b54708"; st.textContent = "Money received but the amount differs from the request. Check the M-Pesa checkout list and your statement."; return; }
    }
    st.textContent = "No reply yet. Open M-Pesa checkout and press “Check” in a minute, or check your M-Pesa statement."; btn.disabled = false;
  };
  $("#dlg").showModal();
}
async function mpayPage() {
  const rows = must(await db.from("mpesa_requests").select("*").order("id", { ascending: false }).limit(60)) || [];
  $("#view").innerHTML = `<h2>M-Pesa checkout</h2><p style="color:var(--mut)">Send a payment prompt to a customer's phone. Prompts from repair and job rows are linked to that job card or job automatically.</p>
    <div class="bar"><button class="btn" id="np" style="background:#12b76a">+ New payment request</button></div>
    <div id="k2card"></div>
    <div class="wrap"><table><thead><tr><th>Time</th><th>Phone</th><th>Amount</th><th>For</th><th>Source</th><th>Via</th><th>Status</th><th>Receipt</th><th></th></tr></thead><tbody id="tb">
    ${rows.map((r, i) => `<tr><td>${esc(String(r.created_at).slice(0, 16).replace("T", " "))}</td><td>${esc(r.phone)}</td><td class="n">${kes(r.amount)}</td><td>${esc(r.ref || r.purpose || "")}</td><td>${esc(r.source)}</td><td>${r.provider === "kopokopo" ? "Kopo Kopo" : "Daraja"}</td>
    <td><span class="tag ${r.status === "Success" ? "ok" : r.status === "Pending" ? "" : "bad"}">${esc(r.status)}</span></td><td>${esc(r.mpesa_receipt || "")}</td>
    <td>${r.status === "Pending" ? `<button class="btn sm ghost" data-chk="${i}">Check</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="9">No payment requests yet.</td></tr>`}</tbody></table></div>`;
  $("#np").onclick = () => mpayDialog({});
  if (can("users.manage")) k2Card();
  $("#tb").onclick = async e => { const b = e.target.closest("[data-chk]"); if (!b) return; const r = await db.functions.invoke("stk-push", { body: { action: "check", public_id: rows[b.dataset.chk].public_id } });
    toast(r.error ? "Could not check" : "Status: " + (r.data?.status || "Pending")); route(); };
}

// Kopo Kopo: one-time "connect my till" for the owner (so every payment to the till appears on the M-Pesa reconcile page)
async function k2Card() {
  const box = $("#k2card"); if (!box) return;
  const r = await db.functions.invoke("stk-push", { body: { action: "k2_status" } });
  if (r.error || !r.data || !r.data.ok) { box.innerHTML = ""; return; }   // Kopo Kopo not set up: show nothing
  box.innerHTML = `<div class="card" style="margin:10px 0"><b>Kopo Kopo till ${esc(r.data.till)}</b> <span class="tag ${r.data.env === "production" ? "ok" : ""}">${esc(r.data.env)}</span>
    <p style="margin:6px 0;color:var(--mut)">Payment prompts can be sent through Kopo Kopo (choose it in the request form). To also list every payment customers make directly to your till, connect it once. Do this once per Kopo Kopo account, not each time.</p>
    <button class="btn sm" id="k2sub">Connect till payments</button> <span id="k2msg" class="msg"></span></div>`;
  $("#k2sub").onclick = async e => { e.target.disabled = true; $("#k2msg").textContent = "Connecting…";
    const x = await db.functions.invoke("stk-push", { body: { action: "k2_subscribe" } });
    if (x.error) { $("#k2msg").style.color = "#b42318"; $("#k2msg").textContent = await fnMsg(x); e.target.disabled = false; return; }
    $("#k2msg").style.color = "#067647"; $("#k2msg").textContent = (x.data && x.data.message) || "Connected."; };
}

// ---- SMS (owner) --------------------------------------------------------------------------
async function smsPage() {
  const tpl = must(await db.from("sms_templates").select("*").order("sort")) || [];
  const out = must(await db.from("sms_outbox").select("*").order("id", { ascending: false }).limit(60)) || [];
  const st = (await db.rpc("sms_auto_status")).data || {};
  const tagc = s => s === "Sent" ? "ok" : s === "Failed" ? "bad" : "";
  $("#view").innerHTML = `<h2>SMS messages</h2>
    <p style="color:var(--mut)">Customers get a text when their repair changes stage and when a payment is received. Messages that are switched off below are never sent. Texts are plain text (a logo cannot be sent by SMS; it is on the tracking page and on every printout).</p>
    <div class="card" style="margin-bottom:12px"><b>Automatic sending:</b> ${st.configured ? '<span class="tag ok">On</span>' : '<span class="tag bad">Not set up</span>'}
      &nbsp; Waiting: <b>${st.queued ?? "?"}</b> &nbsp; Failed: <b>${st.failed ?? "?"}</b> &nbsp; Auto-retry: ${st.pg_cron ? "every 5 min" : "off (use Retry)"}
      <div class="bar" style="margin-top:8px"><button class="btn" id="send">Send waiting now</button> <button class="btn ghost" id="retry">Retry failed</button> <button class="btn ghost" id="test">Send a test SMS</button> ${can("users.manage") ? `<button class="btn ghost" id="setup">${st.configured ? "Change" : "Set up"} automatic sending</button>` : ""}</div>
      ${st.pg_net === false ? '<small class="bad">Your database has no pg_net extension, so sending starts only when you press “Send waiting now”.</small>' : ""}</div>
    <h3>Messages</h3><div class="wrap"><table><thead><tr><th>Message</th><th>Text (use {name} {ticket} {item} {balance} {amount} {link} {phone} {shop}; for jobs {ticket} is the job number and {item} the job type)</th><th>On</th><th></th></tr></thead><tbody id="ttb">
    ${tpl.map((t, i) => `<tr><td>${esc(t.label)}</td><td><textarea data-b="${i}" rows="2" maxlength="300" style="width:100%">${esc(t.body)}</textarea></td><td><input type="checkbox" data-e="${i}" ${t.enabled ? "checked" : ""}></td><td><button class="btn sm" data-s="${i}">Save</button></td></tr>`).join("")}</tbody></table></div>
    <h3>Recent messages</h3><div class="wrap"><table><thead><tr><th>Time</th><th>To</th><th>For</th><th>Message</th><th>Status</th><th>Delivery</th></tr></thead><tbody>
    ${out.map(o => `<tr><td>${esc(String(o.created_at).slice(0, 16).replace("T", " "))}</td><td>${esc(o.phone || "")}</td><td>${esc(o.job_ref || o.kind || "")}</td><td>${esc(o.message)}</td><td><span class="tag ${tagc(o.status)}">${esc(o.status)}</span>${o.error ? `<br><small>${esc(o.error)}</small>` : ""}</td><td>${o.delivery === "Delivered" ? '<span class="tag ok">Delivered</span>' : o.delivery === "Undelivered" ? `<span class="tag bad">Not delivered</span>${o.delivery_note ? `<br><small>${esc(o.delivery_note)}</small>` : ""}` : o.status === "Sent" ? '<small style="color:var(--mut)">awaiting report</small>' : ""}</td></tr>`).join("") || '<tr><td colspan="6">No messages yet.</td></tr>'}</tbody></table></div>`;
  const inv = async (body, okMsg) => { const r = await db.functions.invoke("sms-send", { body }); if (r.error) { let m = r.error.message; try { m = (await r.error.context.json()).message || m; } catch (_) {} toast(m); } else toast(okMsg(r.data)); route(); };
  $("#send").onclick = () => inv({}, d => `Sent ${d?.sent ?? 0}, failed ${d?.failed ?? 0}`);
  $("#retry").onclick = async () => { const r = await db.rpc("sms_retry_failed"); if (r.error) return toast(r.error.message); toast(`${r.data} message(s) queued again`); inv({}, d => `Sent ${d?.sent ?? 0}, failed ${d?.failed ?? 0}`); };
  $("#test").onclick = () => { const p = prompt("Phone number to send a test SMS to (e.g. 0711 952 924):"); if (p) inv({ action: "test", phone: p }, () => "Test SMS sent"); };
  if ($("#setup")) $("#setup").onclick = () => {
    const sec = [...crypto.getRandomValues(new Uint8Array(20))].map(b => b.toString(16).padStart(2, "0")).join("");
    const dlg = document.createElement("dialog"); dlg.innerHTML = `<form method="dialog" style="display:grid;gap:10px;min-width:min(420px,86vw)"><b>Automatic sending</b>
      <label>sms-send function address<input name="u" required placeholder="https://YOUR-PROJECT.supabase.co/functions/v1/sms-send"></label>
      <label>Secret (also saved on the function as SMS_TRIGGER_SECRET)<input name="k" required value="${sec}" readonly></label>
      <small>Copy the secret, then run: <code>supabase secrets set SMS_TRIGGER_SECRET=${sec}</code>. See SMS_SETUP.md.</small><div class="bar"><button class="btn" value="ok">Save</button> <button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div></form>`;
    document.body.appendChild(dlg); dlg.showModal();
    dlg.onclose = async () => { const f = dlg.querySelector("form"); const ok = dlg.returnValue === "ok"; const u = f.u.value.trim(), k = f.k.value; dlg.remove(); if (!ok) return;
      const r = await db.rpc("sms_auto_setup", { p_function_url: u, p_secret: k }); toast(r.error ? r.error.message : "Saved. Automatic sending is on."); route(); };
  };
  $("#ttb").onclick = async e => { const b = e.target.closest("[data-s]"); if (!b) return; const i = b.dataset.s;
    const r = await db.from("sms_templates").update({ body: $(`[data-b="${i}"]`).value, enabled: $(`[data-e="${i}"]`).checked }).eq("key", tpl[i].key); toast(r.error ? r.error.message : "Saved"); };
}

const genPw = () => { const al = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; const b = crypto.getRandomValues(new Uint8Array(10)); return [...b].map(x => al[x % al.length]).join("") + "7"; };
const fnMsg = async r => { let m = r.error.message; try { m = (await r.error.context.json()).message || m; } catch (_) {} return m; };
function simpleDialog(html, onClose) {
  const dlg = document.createElement("dialog"); dlg.innerHTML = `<form method="dialog" style="display:grid;gap:10px;min-width:min(420px,86vw)">${html}</form>`;
  document.body.appendChild(dlg); dlg.showModal(); dlg.onclose = async () => { const f = dlg.querySelector("form"), v = dlg.returnValue; const vals = Object.fromEntries([...f.elements].filter(e => e.name).map(e => [e.name, e.value])); dlg.remove(); if (onClose) await onClose(v, vals); }; return dlg;
}
const siteBase = () => (APP_CONFIG.SITE_URL || (location.origin + location.pathname)).replace(/[#?].*$/, "").replace(/(index|app)\.html$/, "").replace(/\/?$/, "/");
const DELIVERY = [["link", "Email them a link so they choose their own password (recommended)"], ["email", "Email them a temporary password"], ["sms", "SMS them a temporary password"], ["show", "Send nothing: I will give them the details myself"]];
function showLogin(email, password, name, problem) {
  const text = `Franksomi Records login\nWebsite: ${siteBase()}\nEmail: ${email}\nTemporary password: ${password}\n(They will be asked to choose their own password when they first sign in.)`;
  const d = simpleDialog(`<b>${esc(name)}'s login is ready</b>${problem ? `<div class="notewarn">${esc(problem)}<br>Give them the details below yourself.</div>` : ""}<pre style="white-space:pre-wrap;background:#f4f6f8;padding:10px;border-radius:8px;margin:0">${esc(text)}</pre>
    <small>This password is shown only now. Copy it and give it to ${esc(name)} privately. It stops working for anything except choosing their own password.</small><div class="bar"><button class="btn" type="button" id="cp">Copy details</button> <button class="btn ghost" value="ok">Done</button></div>`);
  d.querySelector("#cp").onclick = async e => { try { await navigator.clipboard.writeText(text); e.target.textContent = "Copied ✓"; } catch (_) { e.target.textContent = "Select the text and copy it"; } };
}
function showLink(link, name, problem) {
  const d = simpleDialog(`<b>${esc(name)}'s sign-in link</b><div class="notewarn">${esc(problem)}<br>The account is created. Send them this link yourself (WhatsApp, for example).</div>
    <textarea readonly rows="4" style="width:100%">${esc(link)}</textarea><small>The link works once and expires soon. If it expires, use “New password” on their row to send a fresh one.</small>
    <div class="bar"><button class="btn" type="button" id="cp">Copy link</button> <button class="btn ghost" value="ok">Done</button></div>`);
  d.querySelector("#cp").onclick = async e => { try { await navigator.clipboard.writeText(link); e.target.textContent = "Copied ✓"; } catch (_) { e.target.textContent = "Select the link and copy it"; } };
}
// tell the owner what actually happened after the function answers
function afterDelivery(res, who) {
  const d = res.delivery, sentWhere = d === "sms" ? "by SMS" : "by email";
  if (d === "show") return showLogin(who.email, who.password, who.name);
  if (res.delivered) { simpleDialog(`<b>${d === "link" ? "Invitation sent" : "Details sent"} ✓</b><p style="margin:0">${esc(who.name)} was sent ${d === "link" ? "a sign-in link" : "a temporary password"} ${sentWhere}${d === "sms" ? "" : " (" + esc(who.email) + ")"}.</p>
      <small>${d === "link" ? "They open the link and choose their own password." : "They will be asked to choose their own password the first time they sign in."}</small><div class="bar"><button class="btn" value="ok">Done</button></div>`); return; }
  const problem = `Could not send ${sentWhere}: ${res.delivery_error || "unknown problem"}.`;
  if (d === "link") return showLink(res.link, who.name, problem);
  showLogin(who.email, who.password, who.name, problem);
}
// shared fields: how to deliver, optional phone, temporary password (hidden for the link way)
function deliveryFields(allowLink) {
  const opts = DELIVERY.filter(o => allowLink || o[0] !== "link");
  return `<label>How should they get their details?<select name="d">${opts.map(o => `<option value="${o[0]}">${esc(o[1])}</option>`).join("")}</select></label>
    <label id="phl">Phone number<input name="ph" type="tel" placeholder="0712 345 678" autocomplete="off"><small id="phh">Optional. Needed only to send an SMS.</small></label>
    <label id="pwl">Temporary password (8+ characters)<input name="p" required minlength="8" maxlength="72" value="${genPw()}" autocomplete="off"></label>`;
}
function wireDelivery(dlg) {
  const f = dlg.querySelector("form"), sync = () => { const v = f.d.value; f.p.disabled = v === "link"; $("#pwl", dlg).hidden = v === "link"; f.ph.required = v === "sms"; $("#phh", dlg).textContent = v === "sms" ? "Required for SMS." : "Optional. Needed only to send an SMS."; };
  f.d.onchange = sync; sync();
}
function addPersonDialog() {
  const dlg = simpleDialog(`<b>Add a person</b><label>Full name<input name="n" required maxlength="80"></label><label>Email (their login)<input name="e" type="email" required autocomplete="off"></label>
    <label>Role<select name="r">${ROLES.slice(1).map(r => `<option value="${r[0]}" ${r[0] === "sales" ? "selected" : ""}>${esc(r[1])}</option>`).join("")}</select></label>
    ${deliveryFields(true)}
    <small>Whichever way you choose, they must pick their own password before they can use anything.</small>
    <div class="bar"><button class="btn" value="ok">Create login</button> <button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`, async (v, x) => {
    if (v !== "ok") return;
    const body = { action: "create", email: x.e, full_name: x.n, role: x.r, delivery: x.d, phone: x.ph, redirect_to: siteBase() }; if (x.d !== "link") body.password = x.p;
    toast("Creating the login…");
    const r = await db.functions.invoke("manage-users", { body });
    if (r.error) return toast(await fnMsg(r));
    afterDelivery(r.data || {}, { email: x.e.trim().toLowerCase(), password: x.p, name: x.n.trim() }); usersPage(); });
  wireDelivery(dlg);
}
function resetPwDialog(u) {
  const dlg = simpleDialog(`<b>New sign-in details for ${esc(u.full_name || u.email)}</b>
    ${deliveryFields(true).replace('placeholder="0712 345 678"', `placeholder="0712 345 678" value="${esc(u.phone || "")}"`)}
    <small>Their old password stops working. They must choose a new one of their own the next time they sign in.</small><div class="bar"><button class="btn" value="ok">Continue</button> <button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`, async (v, x) => {
    if (v !== "ok") return; const body = { action: "reset_password", id: u.id, delivery: x.d, phone: x.ph, redirect_to: siteBase() }; if (x.d !== "link") body.password = x.p;
    toast("Working…"); const r = await db.functions.invoke("manage-users", { body });
    if (r.error) return toast(await fnMsg(r));
    afterDelivery(r.data || {}, { email: u.email, password: x.p, name: u.full_name || u.email }); usersPage(); });
  wireDelivery(dlg);
}
$("#chpw").onclick = () => simpleDialog(`<b>Change my password</b><label>New password (8+ characters)<input name="p" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></label>
  <label>Type it again<input name="q" type="password" required autocomplete="new-password"></label><div class="bar"><button class="btn" value="ok">Change</button> <button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`, async (v, x) => {
  if (v !== "ok") return; if (x.p !== x.q) return toast("The two passwords are not the same."); const r = await db.auth.updateUser({ password: x.p }); toast(r.error ? r.error.message : "Password changed"); });

// ---- users & roles (owner) ------------------------------------------------------------------
async function usersPage() {
  const us = must(await db.rpc("list_users")) || [];
  const defs = must(await db.from("perm_defs").select("*").order("sort")) || [];
  const rp = must(await db.from("role_perms").select("*")) || [];
  const ok = (r, p) => !!(rp.find(x => x.role === r && x.perm === p) || {}).allowed;
  const when = t => t ? String(t).slice(0, 16).replace("T", " ") : "never";
  const grps = [...new Set(defs.map(d => d.grp))], others = ROLES.slice(1);
  $("#view").innerHTML = `<h2>Users &amp; roles</h2>
    <div class="bar"><button class="btn" id="addp">+ Add a person</button></div><p style="color:var(--mut)">Each person has one role. The Owner sets what every role may do in the table below; the changes apply the next time that person opens or refreshes the app. The Owner always has every permission.</p>
    <h3>People</h3><div class="wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Last sign-in</th><th>Last action</th><th>Actions (7 days)</th><th></th></tr></thead><tbody id="utb">
    ${us.map((u, i) => `<tr><td><input data-n="${i}" value="${esc(u.full_name || "")}" style="width:150px">${u.must_change_password ? `<div><span class="badge">Has not chosen a password yet</span></div>` : ""}</td><td>${esc(u.email)}${u.phone ? `<div style="color:var(--mut);font-size:12px">${esc(u.phone)}</div>` : ""}</td>
      <td><select data-r="${i}">${ROLES.map(r => `<option value="${r[0]}" ${r[0] === u.role ? "selected" : ""}>${esc(r[1])}</option>`).join("")}</select></td>
      <td><input type="checkbox" data-a="${i}" ${u.active ? "checked" : ""}></td><td>${esc(when(u.last_sign_in_at))}</td><td>${esc(when(u.last_action))}</td><td class="n">${u.actions_7d}</td>
      <td><button class="btn sm" data-save="${i}">Save</button> <button class="btn sm ghost" data-pw="${i}">New password</button></td></tr>`).join("")}</tbody></table></div>
    <p style="color:var(--mut);font-size:13px"><b>Add a person</b> with the button above: you set their role and a temporary password, then give them the login details. Untick <i>Active</i> and Save to switch someone off at once (nothing is deleted, their history stays).</p>
    <h3>What each role is for</h3><div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${ROLES.map(r => `<div class="card"><b style="font-size:15px;display:block;margin:0">${esc(r[1])}</b><div style="color:var(--mut);font-size:13px;margin-top:4px">${esc(r[2])}</div></div>`).join("")}</div>
    <h3>Permissions by role</h3><p style="color:var(--mut);font-size:13px">Tick to allow, untick to block. Each tick saves immediately. <b>Reset</b> puts a role back to its starting permissions.</p>
    <div class="wrap"><table id="pm"><thead><tr><th>Permission</th><th>Owner</th>${others.map(r => `<th style="text-align:center">${esc(r[1])}<br><button class="btn sm ghost" data-reset="${r[0]}">Reset</button></th>`).join("")}</tr></thead><tbody>
    ${grps.map(g => `<tr><th colspan="${others.length + 2}" style="background:var(--navy);color:#fff;text-align:left">${esc(g)}</th></tr>` + defs.filter(d => d.grp === g).map(d => `<tr><td>${esc(d.label)}</td><td style="text-align:center">✓</td>
      ${others.map(r => d.perm === "users.manage" ? `<td style="text-align:center;color:var(--mut)">—</td>` : `<td style="text-align:center"><input type="checkbox" data-role="${r[0]}" data-perm="${d.perm}" ${ok(r[0], d.perm) ? "checked" : ""}></td>`).join("")}</tr>`).join("")).join("")}
    </tbody></table></div>`;
  $("#addp").onclick = addPersonDialog;
  $("#utb").onclick = async e => { const pw = e.target.closest("[data-pw]"); if (pw) return resetPwDialog(us[pw.dataset.pw]); const b = e.target.closest("[data-save]"); if (!b) return; const i = b.dataset.save, u = us[i];
    if (!confirm(`Save ${$(`[data-n="${i}"]`).value || u.email} as ${roleName($(`[data-r="${i}"]`).value)}${$(`[data-a="${i}"]`).checked ? "" : " (switched OFF)"}?`)) return;
    const r = await db.rpc("set_user", { p_id: u.id, p_name: $(`[data-n="${i}"]`).value, p_role: $(`[data-r="${i}"]`).value, p_active: $(`[data-a="${i}"]`).checked });
    if (r.error) toast(r.error.message); else { toast("Saved"); usersPage(); } };
  $("#pm").onchange = async e => { const c = e.target.closest("[data-perm]"); if (!c) return;
    const r = await db.rpc("set_role_perm", { p_role: c.dataset.role, p_perm: c.dataset.perm, p_allowed: c.checked });
    if (r.error) { c.checked = !c.checked; toast(r.error.message); } else toast("Saved"); };
  $("#pm").onclick = async e => { const b = e.target.closest("[data-reset]"); if (!b) return; if (!confirm(`Put ${roleName(b.dataset.reset)} back to the starting permissions?`)) return;
    const r = await db.rpc("reset_role_perms", { p_role: b.dataset.reset }); if (r.error) toast(r.error.message); else { toast("Reset"); usersPage(); } };
}

// ---- activity log: who did what (owner and anyone given the right) -----------------------------
async function auditPage() {
  const rows = must(await db.from("audit_log").select("*").order("id", { ascending: false }).limit(1000)) || [];
  const people = must(await db.from("profiles").select("id,full_name,role")) || [];
  const st = can("users.manage") ? (await db.rpc("list_users")).data || [] : [];
  const nm = id => (people.find(p => p.id === id) || {}).full_name || (id ? "user" : "system");
  const when = t => t ? String(t).slice(0, 16).replace("T", " ") : "never";
  const what = r => { const n = r.new_row || {}, o = r.old_row || {};
    if (r.tbl === "role_perms") return `${roleName(n.role || o.role)}: ${n.perm || o.perm} ${n.allowed ? "allowed" : "blocked"}`;
    if (r.tbl === "profiles" && r.op === "INSERT") return `account created as ${roleName(n.role)}`;
    if (r.tbl === "profiles" && r.op === "UPDATE") return [n.password_reset ? "password reset by owner" : "", n.role !== o.role ? `role ${roleName(o.role)} → ${roleName(n.role)}` : "", n.active !== o.active ? (n.active ? "switched on" : "switched off") : "", n.full_name !== o.full_name ? "name changed" : ""].filter(Boolean).join(", ") || "profile saved";
    if (r.op === "INSERT") return "added"; if (r.op === "DELETE") return "deleted";
    const ch = Object.keys(n).filter(k => JSON.stringify(n[k]) !== JSON.stringify(o[k])); return "changed " + ch.join(", "); };
  const tbls = [...new Set(rows.map(r => r.tbl))].sort();
  $("#view").innerHTML = `<h2>Activity log</h2><p style="color:var(--mut)">The last ${rows.length} changes: who added, changed or deleted what, including changes to users and permissions.</p>
    ${st.length ? `<h3>Staff</h3><div class="wrap"><table><thead><tr><th>Person</th><th>Role</th><th>Active</th><th>Last sign-in</th><th>Last action</th><th>Actions (7 days)</th></tr></thead><tbody>${st.map(u => `<tr><td>${esc(u.full_name || u.email)}</td><td>${esc(roleName(u.role))}</td><td>${u.active ? "yes" : "<b>OFF</b>"}</td><td>${esc(when(u.last_sign_in_at))}</td><td>${esc(when(u.last_action))}</td><td class="n">${u.actions_7d}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <h3>Changes</h3><div class="bar"><select id="fu"><option value="">Everyone</option>${people.map(p => `<option value="${p.id}">${esc(p.full_name || "user")} (${esc(roleName(p.role))})</option>`).join("")}</select>
      <select id="ft"><option value="">All records</option>${tbls.map(t => `<option>${esc(t)}</option>`).join("")}</select><input id="fd" type="date" title="From date"><input id="fq" placeholder="Search…" style="max-width:200px"><button class="btn ghost" id="csv">Download CSV</button><span id="fc" style="color:var(--mut)"></span></div>
    <div class="wrap"><table><thead><tr><th>When</th><th>Who</th><th>Record</th><th>What</th></tr></thead><tbody id="atb"></tbody></table></div>`;
  let shown = [];
  const draw = () => { const u = $("#fu").value, t = $("#ft").value, d = $("#fd").value, q = $("#fq").value.toLowerCase();
    shown = rows.filter(r => (!u || r.by_user === u) && (!t || r.tbl === t) && (!d || String(r.at).slice(0, 10) >= d) && (!q || (nm(r.by_user) + r.tbl + r.row_id + what(r)).toLowerCase().includes(q)));
    $("#atb").innerHTML = shown.slice(0, 300).map(r => `<tr><td>${esc(when(r.at))}</td><td>${esc(nm(r.by_user))}</td><td>${esc(r.tbl)} #${esc(r.row_id)}</td><td>${esc(what(r))}</td></tr>`).join("") || `<tr><td colspan="4">Nothing matches.</td></tr>`;
    $("#fc").textContent = `${shown.length} found` + (shown.length > 300 ? " (first 300 shown; the CSV has all)" : ""); };
  ["fu", "ft", "fd"].forEach(i => $("#" + i).onchange = draw); $("#fq").oninput = draw; draw();
  $("#csv").onclick = () => { const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`; const csv = ["When,Who,Record,What"].concat(shown.map(r => [r.at, nm(r.by_user), r.tbl + " #" + r.row_id, what(r)].map(q).join(","))).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "activity-log.csv"; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 2000); };
}

// ---- shell ------------------------------------------------------------------------
async function refreshLookups() {
  const li = must(await db.from("list_items").select("*").order("value")) || [];
  lists = { item_type: li.filter(x => x.kind === "item_type"), brand: li.filter(x => x.kind === "brand"), stock_type: li.filter(x => x.kind === "stock_type") };
  stockItems = must(await db.from("v_stock").select("id,code,description,on_hand,selling_price,stock_type,unit_cost").order("code")) || [];
  suppliers = must(await db.from("suppliers").select("id,name").order("name")) || [];
  accounts = [];
  if (can("accounts.view")) { let ar = await db.from("credit_accounts").select("id,name,active,credit_limit,kra_pin").order("name"); if (ar.error) ar = await db.from("credit_accounts").select("id,name,active,credit_limit").order("name"); accounts = must(ar) || []; }
  catalog = (must(await db.from("service_catalog").select("*").order("name")) || []).filter(c => c.active !== false);
}
async function route() {
  const k = location.hash.slice(1) || "dashboard";
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.k === k));
  $("#view").onclick = $("#view").onsubmit = null; (window.__t || []).forEach(clearInterval); window.__t = [];
  const nv = NAV.find(n => n[0] === k) || (T[k] && [k, 0, T[k].perm + ".view"]);
  if (nv && nv[2] && !can(nv[2]) && !(k === "suppliers")) { $("#view").innerHTML = `<h2>Not allowed</h2><p>Your role (${esc(roleName(me.role))}) does not include this page. Ask the owner if you need it.</p>`; return; }
  const decorate = () => { const h = document.querySelector("#view > h2"); if (h) { const w = document.createElement("div"); w.className = "pagehead"; w.innerHTML = BRAND.icon(k, 22); h.replaceWith(w); w.appendChild(h); } };
  try { if (k === "dashboard") await dashboard(); else if (k === "lists") await listsPage(); else if (k === "docs") await docsPage(); else if (k === "eod") await eodPage(); else if (k === "monthly") await monthlyPage(); else if (k === "summary") await summaryPage();
    else if (k === "contracts") await contractsPage(); else if (k === "unpaid") await unpaidPage(); else if (k === "health") await healthPage(); else if (k === "assets") await assetsPage(); else if (k === "money") await moneyPage(); else if (k === "staffpay") await staffPayPage(); else if (k === "mpesa") await mpesaPage(); else if (k === "mpay") await mpayPage(); else if (k === "sms") await smsPage(); else if (k === "orders") await ordersPage(); else if (k === "accounts") await accountsPage(); else if (k === "quotes") await quotesPage(); else if (k === "equipment") await equipmentPage(); else if (k === "till") await tillPage(); else if (k === "wifi") await wifiPage(); else if (k === "vault") await vaultPage(); else if (k === "projects") await projectsPage(); else if (k === "policies") await policiesPage(); else if (k === "payables") await payablesPage(); else if (k === "chat") await chatPage(); else if (k === "zones") await zonesPage(); else if (k === "audit") await auditPage(); else if (k === "users") await usersPage(); else if (T[k]) await tablePage(k); decorate(); } catch (e) { console.error(e); }
}
async function start() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { $("#app").hidden = true; $("#login").hidden = false; $("#gateForm").hidden = true; $("#loginForm").hidden = false; return; }
  const acc = await db.rpc("my_access");
  me = acc.data;
  if (me && me.active && me.must_change) return passwordGate(session);
  if (!me || !me.active) { await db.auth.signOut(); $("#app").hidden = true; $("#login").hidden = false; $("#gateForm").hidden = true; $("#loginForm").hidden = false; $("#loginMsg").textContent = "This account is switched off. Ask the owner."; return; }
  me.full_name = me.name;
  $("#login").hidden = true; $("#app").hidden = false; $("#gateForm").hidden = true; $("#loginForm").hidden = false;
  $("#who").textContent = `${me.full_name || session.user.email} · ${roleName(me.role)}`;
  $("#nav").innerHTML = navFor().map(([k, l]) => `<a href="#${k}" data-k="${k}">${BRAND.icon(k, 17)}${esc(l)}</a>`).join("");
  await refreshLookups(); route();
  clearInterval(window.__beat); if (can("chat.use")) { chatBeat(); window.__beat = setInterval(chatBeat, 30000); }
}
let lastLoginPw = "";
// shown instead of the app while the owner's temporary password / sign-in link is still the only thing they have
function passwordGate(session) {
  me = null; $("#app").hidden = true; $("#login").hidden = false; $("#loginForm").hidden = true; $("#gateForm").hidden = false; $("#gateMsg").textContent = "";
  $("#gateWho").textContent = `Signed in as ${session.user.email}. Before you start, set a password only you know.`; $("#gateForm").reset();
}
$("#gateForm").onsubmit = async e => { e.preventDefault(); const f = e.target, msg = $("#gateMsg"), p = f.p.value;
  if (p !== f.q.value) return void (msg.textContent = "The two passwords are not the same.");
  if (p.length < 8) return void (msg.textContent = "Use at least 8 characters.");
  if (lastLoginPw && p === lastLoginPw) return void (msg.textContent = "Choose a different password from the temporary one.");
  if (/^(12345678|password|qwerty12|11111111)/i.test(p)) return void (msg.textContent = "That password is too easy to guess.");
  msg.textContent = "Saving…"; const u = await db.auth.updateUser({ password: p });
  if (u.error) return void (msg.textContent = /same|different/i.test(u.error.message) ? "Choose a different password from the temporary one." : u.error.message);
  const ok = await db.rpc("password_changed");
  if (ok.error || ok.data !== true) return void (msg.textContent = "Your password was not saved. Please try again.");
  lastLoginPw = ""; start(); };
$("#gateOut").onclick = async () => { await db.auth.signOut(); lastLoginPw = ""; start(); };
$("#loginForm").onsubmit = async e => { e.preventDefault(); const f = e.target; const r = await db.auth.signInWithPassword({ email: f.email.value, password: f.password.value });
  if (r.error) $("#loginMsg").textContent = "Wrong email or password."; else { $("#loginMsg").textContent = ""; lastLoginPw = f.password.value; start(); } };
$("#logout").onclick = async () => { clearInterval(window.__beat); await db.auth.signOut(); location.hash = ""; start(); };
// a sign-in link that is expired or already used comes back with an error in the address
if (/error_description|otp_expired|access_denied/.test(location.hash)) { $("#loginMsg").textContent = "That sign-in link has expired or was already used. Ask the owner to send you a new one."; history.replaceState(null, "", location.pathname); }
window.addEventListener("hashchange", () => me && route());
start();
