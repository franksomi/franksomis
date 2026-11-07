/* Franksomi Records v27 — service contracts (ICT support, CCTV, Electrical, Networking) and letters of acceptance.
   Loaded before app.js; uses app.js globals (db, can, kes, esc, $, toast, must, head, printHtml, SHOP, iso) only when called. */

const CT_SERVICES = ["ICT support contract", "CCTV", "Electrical", "Networking"];
const CT_BLURB = {
  "ICT support contract": "A monthly or yearly plan: scheduled visits, call-outs when something breaks, backups, updates and help for staff.",
  "CCTV": "Site survey, supply, installation and mobile viewing, with after-sales support.",
  "Electrical": "Wiring, lighting, distribution boards and earthing for new buildings and repairs, quoted in writing before work starts.",
  "Networking": "Structured cabling, Wi-Fi coverage, routers, switches and internet links.",
};
const CT_TAIL = [
  { h: "Changes", t: "Any change to the scope, price or dates must be agreed in writing and signed or confirmed by email by both parties. Extra work is not started, and not charged, until it has been agreed in this way." },
  { h: "Notices", t: "Notices under this contract are in writing and sent to the addresses or email addresses given at the top of this contract (or any new address a party tells the other in writing)." },
  { h: "Governing law and disputes", t: "This contract is governed by the laws of Kenya. The parties will first try to settle any dispute by discussion between their representatives. If that fails, the dispute may be taken to the courts of Kenya." },
  { h: "Whole agreement", t: "This contract, with the schedule of items and any written changes, is the whole agreement between the parties about this work and replaces earlier discussions about it." },
];
const CT_LIAB = { h: "Liability", t: "Franksomi will use reasonable care and skill. Except where the law does not allow it (for example death or personal injury caused by negligence, or fraud), Franksomi's total liability under this contract is limited to the amount the Client has paid under it in the 12 months before the claim, and Franksomi is not liable for indirect loss, loss of profit or loss of data." };
const CT_TEMPLATES = {
  "ICT support contract": {
    billing: "Monthly", months: 12, payment_days: 30,
    scope: "Franksomi will provide ICT support to the Client at [site / premises] as follows:\n• Scheduled visits: 2 visits each month to inspect computers, the network, printers and other ICT equipment and to carry out preventive maintenance.\n• Call-outs: when something breaks the Client reports it by phone or message. We respond within 1 working day (within 4 working hours for a fault that stops work) and attend site when it cannot be fixed remotely.\n• Backups: we set up and check backups of the data the Client names, and test a restore every month.\n• Updates: operating system, antivirus and key software updates on the covered equipment. We tell the Client beforehand about any update that needs downtime.\n• Staff help: telephone and on-site help for staff using the covered equipment and software, including simple guidance and training.\n• Reporting: a short service report each month.\nThe covered equipment is listed in the schedule. Equipment not listed, and new equipment, can be added by written agreement.",
    items: [{ desc: "[Covered equipment and where it is, e.g. 12 desktop computers, administration block]", qty: 1, price: 0 }],
    milestones: [],
    clauses: [
      { h: "What the plan fee does not cover", t: "Replacement parts, new equipment, damage caused by misuse, power surges, fire, flood or theft, and projects such as new cabling or new systems are not covered by the plan fee. Franksomi will give a written quotation before doing any such work." },
      { h: "Support hours", t: "Support is given on working days from 8:00 am to 5:00 pm. Urgent work outside those hours may be charged at a rate agreed in writing beforehand." },
      { h: "The Client's responsibilities", t: "The Client will name a contact person, give safe access to the equipment and the premises, keep software licences current, provide power, and report faults promptly." },
      { h: "Data and confidentiality", t: "Franksomi will keep the Client's information confidential and use it only to provide the services. Each party will follow the Data Protection Act, 2019 as it applies to it. The Client remains responsible for its own data and for deciding what is backed up." },
      CT_LIAB,
      { h: "Renewal and ending", t: "The contract ends on the end date unless both parties agree in writing to renew it. Either party may end it earlier by giving 30 days' written notice, or immediately by written notice if the other party commits a serious breach and does not put it right within 14 days. Fees for the period up to the end of the contract stay payable." },
    ],
  },
  "CCTV": {
    billing: "One-off", months: 0, payment_days: 30,
    scope: "Franksomi will survey, supply, install and commission a CCTV system at [site / premises], as listed in the schedule, and provide after-sales support, as follows:\n• Site survey: before work starts we visit the site, agree camera positions and cable routes, and confirm them in writing.\n• Supply and installation: the cameras, recorder, storage, cabling, power supplies and fittings in the schedule, installed neatly and tested.\n• Mobile viewing: remote viewing set up on up to 5 phones chosen by the Client, using the Client's own passwords.\n• Handover: a short demonstration of how to view, search and export recordings.\n• After-sales support: 12 months' warranty as set out below, and faults attended within 2 working days.",
    items: [{ desc: "[Cameras: type and number, e.g. 4MP IP dome cameras]", qty: 1, price: 0 }, { desc: "[Recorder (NVR/DVR) and hard disk]", qty: 1, price: 0 }, { desc: "Cabling, connectors, power supplies and fittings", qty: 1, price: 0 }, { desc: "Installation, setup and commissioning", qty: 1, price: 0 }],
    milestones: [{ label: "Deposit on signing", pct: 50, when: "start" }, { label: "Balance on completion", pct: 50, when: "end" }],
    clauses: [
      { h: "Materials and ownership", t: "Equipment remains the property of Franksomi until it has been paid for in full. The Client will look after equipment on site once it is delivered." },
      { h: "The Client's responsibilities", t: "The Client will give access to the site, provide mains power points and a safe working area, and decide who may view and export recordings." },
      { h: "Privacy and lawful use", t: "The Client is responsible for lawful use of the system, including putting up notices where cameras record, controlling who can view or export footage, and following the Data Protection Act, 2019. Franksomi will not copy or share recordings except as the Client instructs." },
      { h: "Warranty", t: "Franksomi will repair or replace equipment that fails because of a manufacturing fault, and put right faulty workmanship, for 12 months from handover. The warranty does not cover lightning or power surges, vandalism, theft, misuse, tampering, or repairs done by others." },
      { h: "Completion and handover", t: "When the work is finished Franksomi will invite the Client to inspect it and sign the handover. The work is treated as accepted if the Client does not give a written list of faults within 7 days of handover." },
      { h: "Extra work", t: "Extra cameras or changes to the layout are quoted in writing before they are done." },
      CT_LIAB,
      { h: "Cancelling", t: "If the Client cancels after work or ordering has started, the Client pays for the work done and the materials already ordered or delivered. Either party may end the contract if the other commits a serious breach and does not put it right within 14 days of written notice." },
    ],
  },
  "Electrical": {
    billing: "One-off", months: 0, payment_days: 30,
    scope: "Franksomi will carry out electrical work at [site / premises], as listed in the schedule and quoted in writing before work started:\n• Wiring, lighting, distribution boards and earthing for [new building / repairs], with the materials and labour itemised in the schedule.\n• Work carried out by competent electricians, following good practice and the Kenyan regulations that apply.\n• Testing of the installation (continuity, insulation and earth tests) before handover, with the results given to the Client on request.\n• Tidying the work area and removing our waste.\n• 12 months' warranty on workmanship from handover.",
    items: [{ desc: "[Wiring, lighting points and sockets, with quantities]", qty: 1, price: 0 }, { desc: "[Distribution board(s) and breakers]", qty: 1, price: 0 }, { desc: "[Earthing]", qty: 1, price: 0 }, { desc: "Labour and testing", qty: 1, price: 0 }],
    milestones: [{ label: "Deposit on signing", pct: 50, when: "start" }, { label: "Balance on completion", pct: 50, when: "end" }],
    clauses: [
      { h: "Price and extra work", t: "The price covers the schedule only. Extra work is done only on the Client's written instruction at a price agreed beforehand." },
      { h: "Power and access", t: "The Client will give safe access, agree times when power may be switched off, and arrange any application to the power utility or approval by a regulator, unless the schedule lists it as part of our work." },
      { h: "Safety", t: "The Client will keep people clear of the work areas. Franksomi is not responsible for harm caused by people entering or using an area or circuit against our instructions, or by changes made by others after handover." },
      { h: "Materials and ownership", t: "Materials remain the property of Franksomi until paid for in full. The Client will keep materials delivered to the site safe." },
      { h: "Warranty", t: "Franksomi will put right faulty workmanship, and replace materials that fail because of a manufacturing fault, for 12 months from handover. The warranty does not cover damage from power surges, overloading, misuse, tampering or work by others." },
      { h: "Completion and handover", t: "When the work is finished Franksomi will invite the Client to inspect it and sign the handover. The work is treated as accepted if the Client does not give a written list of faults within 7 days of handover." },
      CT_LIAB,
      { h: "Cancelling", t: "If the Client cancels after work or ordering has started, the Client pays for the work done and the materials already ordered or delivered. Either party may end the contract if the other commits a serious breach and does not put it right within 14 days of written notice." },
    ],
  },
  "Networking": {
    billing: "One-off", months: 0, payment_days: 30,
    scope: "Franksomi will design, supply, install and test networking at [site / premises], as listed in the schedule:\n• Survey and design: we visit the site, agree where cabling, equipment and access points go, and confirm it in writing.\n• Structured cabling: cable runs, outlets and patch panels, labelled and tested, with a test report.\n• Wi-Fi: access points placed for the coverage agreed in the survey, with secure network names and passwords.\n• Routers, switches and internet links: supplied and configured as listed. Unless the schedule says otherwise, the Client contracts directly with its internet provider.\n• Documentation: a simple network diagram and the settings and passwords handed to the person the Client names.\n• 12 months' warranty and support as set out below.",
    items: [{ desc: "[Structured cabling: number of points and cable type]", qty: 1, price: 0 }, { desc: "[Wi-Fi access points]", qty: 1, price: 0 }, { desc: "[Router and switches]", qty: 1, price: 0 }, { desc: "Installation, configuration and testing", qty: 1, price: 0 }],
    milestones: [{ label: "Deposit on signing", pct: 50, when: "start" }, { label: "Balance on completion", pct: 50, when: "end" }],
    clauses: [
      { h: "The Client's responsibilities", t: "The Client will give access to the site and to rooms, ceilings and cabinets where work is needed, provide mains power, and arrange its internet service unless the schedule includes it. Speed and reliability of the internet link depend on the provider." },
      { h: "Passwords and security", t: "Administrator passwords and settings are handed to the Client's named person at completion. The Client is responsible for keeping them safe. Franksomi keeps a copy only if the Client asks us to." },
      { h: "Materials and ownership", t: "Equipment remains the property of Franksomi until paid for in full. The Client will look after equipment on site once it is delivered." },
      { h: "Warranty and support", t: "Franksomi will repair or replace equipment that fails because of a manufacturing fault, and put right faulty workmanship, for 12 months from handover, and will attend faults within 2 working days. The warranty does not cover power surges, lightning, vandalism, theft, misuse, tampering or changes made by others." },
      { h: "Completion and handover", t: "When the work is finished Franksomi will invite the Client to inspect it and sign the handover. The work is treated as accepted if the Client does not give a written list of faults within 7 days of handover." },
      { h: "Extra work", t: "Extra points, equipment or changes to the layout are quoted in writing before they are done." },
      CT_LIAB,
      { h: "Cancelling", t: "If the Client cancels after work or ordering has started, the Client pays for the work done and the materials already ordered or delivered. Either party may end the contract if the other commits a serious breach and does not put it right within 14 days of written notice." },
    ],
  },
};

// ---- dates and schedule (mirrors the database function contract_sched; the database is what actually charges) ------------
const ctPad = n => String(n).padStart(2, "0");
function ctAddMonths(d, k) { const [y, m, dd] = d.split("-").map(Number), t = m - 1 + k, yy = y + Math.floor(t / 12), mm = ((t % 12) + 12) % 12, dim = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate(); return `${yy}-${ctPad(mm + 1)}-${ctPad(Math.min(dd, dim))}`; }
const ctEndFor = (start, months) => { const d = new Date(ctAddMonths(start, months) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const ctMon = d => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(d.slice(5, 7)) - 1] + " " + d.slice(0, 4);
const ctMoney = x => Math.round(Number(x || 0) * 100) / 100;
function ctSched(c) {
  const out = [];
  if (c.billing === "One-off") {
    const v = ctMoney((c.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0)), ms = c.milestones || [];
    if (!ms.length) return v > 0 ? [{ n: 1, label: "Full payment", due_on: c.end_date, amount: v }] : [];
    let tot = 0; ms.forEach((m, k) => { const a = k === ms.length - 1 ? ctMoney(v - tot) : ctMoney(v * (Number(m.pct) || 0) / 100); tot += a; if (a > 0) out.push({ n: k + 1, label: (m.label || "").trim() || "Payment " + (k + 1), due_on: m.due_on || c.start_date, amount: a }); });
    return out;
  }
  const step = c.billing === "Monthly" ? 1 : 12;
  for (let k = 0; k < 120; k++) { const d = ctAddMonths(c.start_date, k * step); if (d > c.end_date) break; if (Number(c.fee) > 0) out.push({ n: k + 1, label: c.billing === "Monthly" ? "Support fee – " + ctMon(d) : "Annual fee – year " + (k + 1), due_on: d, amount: ctMoney(c.fee) }); }
  return out;
}
const ctValue = c => ctMoney(ctSched(c).reduce((s, x) => s + x.amount, 0));
const ctNo = c => c.contract_no || "DRAFT";
const ctDate = d => d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";
const ctPre = s => esc(s || "").replace(/\n/g, "<br>");
const ctWhat = c => ({ "ICT support contract": "ICT support", CCTV: "CCTV supply and installation", Electrical: "electrical installation", Networking: "networking installation" })[c.service] || c.service;

// ---- printable documents ---------------------------------------------------------------------------------------------------------------
function contractHtml(c, sched, value) {
  const draft = c.status === "Draft", n = ctNo(c), rc = c.billing !== "One-off", clauses = [...(c.clauses || [])];
  let k = 3; const num = () => ++k;
  const party = (name, addr, pin, rep, title) => `<b>${esc(name)}</b>${addr ? `, ${esc(addr)}` : ""}${pin ? `, KRA PIN ${esc(pin)}` : ""}${rep ? `, represented by ${esc(rep)}${title ? ` (${esc(title)})` : ""}` : ""}`;
  const items = (c.items || []).filter(i => String(i.desc || "").trim());
  const itemsTbl = !items.length ? "" : rc
    ? `<h3>Schedule: covered equipment and sites</h3><table><thead><tr><th>Description</th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(i.desc)}</td></tr>`).join("")}</tbody></table>`
    : `<h3>Schedule of items and prices</h3><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price (KES)</th><th>Amount (KES)</th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(i.desc)}</td><td>${esc(i.qty)}</td><td>${kes(i.price)}</td><td>${kes((Number(i.qty) || 0) * (Number(i.price) || 0))}</td></tr>`).join("")}<tr><th colspan="3" align="right">CONTRACT PRICE (KES)</th><th>${kes(value)}</th></tr></tbody></table>`;
  const schedTbl = `<table><thead><tr><th>Due</th><th>Payment</th><th>Amount (KES)</th></tr></thead><tbody>${sched.map(s => `<tr><td>${esc(ctDate(s.due_on))}</td><td>${esc(s.label)}</td><td>${kes(s.amount)}</td></tr>`).join("")}<tr><th colspan="2" align="right">TOTAL (KES)</th><th>${kes(value)}</th></tr></tbody></table>`;
  return head("SERVICE CONTRACT", n) + (draft ? `<p class="box"><b>DRAFT</b> – not yet in force</p>` : c.status === "Terminated" ? `<p class="box"><b>TERMINATED</b>${c.end_note ? ": " + esc(c.end_note) : ""}</p>` : "") +
    `<h2 style="margin:10px 0 2px">${esc(c.service === "ICT support contract" ? "ICT Support Contract" : c.service + " Contract")}</h2><p style="margin:0 0 8px"><b>${esc(c.client_name)}</b>${c.site ? " · " + esc(c.site) : ""} &nbsp;·&nbsp; Contract no. <b>${esc(n)}</b>${c.lpo_no ? " &nbsp;·&nbsp; Client LPO / PO no. " + esc(c.lpo_no) : ""}${c.quote_ref ? " &nbsp;·&nbsp; Our quotation " + esc(c.quote_ref) : ""}</p>` +
    `<p>This contract is made${c.signed_on ? " on <b>" + esc(ctDate(c.signed_on)) + "</b>" : ""} between:</p>
     <p>(1) ${party(SHOP.name, SHOP.place + (SHOP.phone ? ", tel " + SHOP.phone : "") + (SHOP.web ? ", " + SHOP.web : ""), "", c.our_rep, c.our_rep_title)} (<b>“Franksomi”</b>); and</p>
     <p>(2) ${party(c.client_name, [c.client_address, c.client_contact].filter(Boolean).join(", "), c.client_pin, c.client_rep, c.client_rep_title)} (<b>“the Client”</b>).</p>
     <h3>1. Scope of the services</h3><p>${ctPre(c.scope)}</p>${itemsTbl}
     <h3>2. Period</h3><p>The contract starts on <b>${esc(ctDate(c.start_date))}</b> and ${rc ? "runs until" : "the work is to be completed by"} <b>${esc(ctDate(c.end_date))}</b>.</p>
     <h3>3. Price and payment</h3><p>${rc ? (c.billing === "Monthly" ? `The Client pays a monthly fee of <b>KES ${kes(c.fee)}</b>.` : `The Client pays a yearly fee of <b>KES ${kes(c.fee)}</b>.`) : `The Client pays the contract price of <b>KES ${kes(value)}</b> in the stages below.`} Amounts are in Kenya Shillings. Each payment is charged to the Client's account with Franksomi on its due date and is to be paid within <b>${c.payment_days} days</b>.</p>${schedTbl}` +
    clauses.concat(CT_TAIL).map(x => `<h3>${num()}. ${esc(x.h)}</h3><p>${ctPre(x.t)}</p>`).join("") +
    `<p style="margin-top:14px">Signed by the parties:</p>
     <table style="margin-top:6px"><tr><td style="width:50%;vertical-align:top"><b>For Franksomi Solution Ltd</b><br>Name: ${esc(c.our_rep)}<br>Title: ${esc(c.our_rep_title)}<br><br>Signature: ______________________<br><br>Date: ______________________</td>
     <td style="vertical-align:top"><b>For the Client: ${esc(c.client_name)}</b><br>Name: ${esc(c.client_rep || "______________________")}<br>Title: ${esc(c.client_rep_title || "______________________")}<br><br>Signature: ______________________<br><br>Date: ______________________ &nbsp; Stamp:</td></tr></table>`;
}
function letterHtml(c, sched, value) {
  const rc = c.billing !== "One-off", no = c.acceptance_no || "DRAFT", dt = c.acceptance_date || iso(new Date()), first = sched[0];
  const ref = [c.lpo_no && "your LPO / PO no. " + esc(c.lpo_no), c.quote_ref && "our quotation " + esc(c.quote_ref)].filter(Boolean).join(" and ");
  return head("LETTER OF ACCEPTANCE", no) + (c.acceptance_no ? "" : `<p class="box"><b>DRAFT</b> – number not yet issued</p>`) +
    `<p style="margin:12px 0 0">${esc(ctDate(dt))}</p><p>Our ref: <b>${esc(no)}</b> &nbsp;/&nbsp; Contract <b>${esc(ctNo(c))}</b></p>
     <p>${c.client_rep ? esc(c.client_rep) + "<br>" : "The Manager<br>"}${c.client_rep_title ? esc(c.client_rep_title) + "<br>" : ""}<b>${esc(c.client_name)}</b><br>${esc(c.client_address || "")}</p>
     <p>Dear ${c.client_rep ? "Sir / Madam" : "Sir / Madam"},</p>
     <p><b>RE: LETTER OF ACCEPTANCE — ${esc(c.service === "ICT support contract" ? "ICT SUPPORT CONTRACT" : c.service.toUpperCase())}${c.site ? " — " + esc(c.site.toUpperCase()) : ""}</b></p>
     <p>Thank you for ${ref ? "the award referred to in " + ref : "choosing Franksomi Solution Ltd"}. We are pleased to confirm that <b>Franksomi Solution Ltd accepts</b> the engagement to provide ${esc(ctWhat(c))}${c.site ? " at " + esc(c.site) : ""} on the terms of Contract <b>${esc(ctNo(c))}</b>, which accompanies this letter. In summary:</p>
     <table><tr><th style="width:30%">Work</th><td>${esc(ctWhat(c))}${c.site ? ", " + esc(c.site) : ""}</td></tr>
     <tr><th>${rc ? (c.billing === "Monthly" ? "Monthly fee" : "Yearly fee") : "Contract price"}</th><td>KES ${kes(rc ? c.fee : value)}${rc ? ` (total over the contract: KES ${kes(value)})` : ""}</td></tr>
     <tr><th>Period</th><td>${esc(ctDate(c.start_date))} to ${esc(ctDate(c.end_date))}</td></tr>
     <tr><th>Payment</th><td>${sched.length > 1 ? (rc ? `${sched.length} ${c.billing === "Monthly" ? "monthly" : "yearly"} charges from ${esc(ctDate(first.due_on))}` : sched.map(s => `${esc(s.label)}: KES ${kes(s.amount)} (${esc(ctDate(s.due_on))})`).join("<br>")) : first ? `KES ${kes(first.amount)} on ${esc(ctDate(first.due_on))}` : ""}; payable within ${c.payment_days} days of each charge${c.account_id ? ", on your account with us" : ""}</td></tr></table>
     <p>We will start on <b>${esc(ctDate(c.start_date))}</b>. Please sign the acceptance below and return a copy to us, together with the signed contract, so that we can confirm arrangements${rc ? " for the first visit" : " for the site survey and delivery"}.</p>
     <p>Yours faithfully,</p><p><br>______________________<br><b>${esc(c.our_rep)}</b><br>${esc(c.our_rep_title)}, ${SHOP.name}</p>
     <div class="box" style="margin-top:14px"><b>ACCEPTANCE BY THE CLIENT</b><br>We, <b>${esc(c.client_name)}</b>, confirm that we have read and accept Contract ${esc(ctNo(c))} and this letter.<br><br>
     Name: ${esc(c.client_rep || "______________________")} &nbsp; Title: ${esc(c.client_rep_title || "______________________")}<br><br>Signature: ______________________ &nbsp; Date: ______________________ &nbsp; Stamp:</div>`;
}

// ---- the page --------------------------------------------------------------------------------------------------------------------------
const ctTag = s => `<span class="tag ${s === "Active" ? "ok" : s === "Terminated" ? "bad" : s === "Draft" ? "warn" : ""}">${esc(s)}</span>`;
async function contractsPage() {
  if (can("docs.issue")) { try { const r = await db.rpc("contract_run"); if (r && !r.error && r.data && r.data.posted) toast(r.data.posted + " contract charge(s) posted to credit accounts"); } catch (_) {} }
  const rows = must(await db.from("contracts").select("*").order("id", { ascending: false }).limit(500)) || [];
  const ins = must(await db.from("contract_installments").select("contract_id,amount,posted,due_on")) || [];
  const accs = {}; if (can("accounts.view")) (must(await db.from("credit_accounts").select("id,name")) || []).forEach(a => accs[a.id] = a.name);
  const edit = can("docs.add") || can("docs.edit"), appr = can("docs.void"), today = iso(new Date()), soon = iso(new Date(Date.now() + 30 * 864e5));
  const charged = id => ins.filter(i => i.contract_id === id && i.posted).reduce((s, i) => s + Number(i.amount), 0), waiting = id => ins.filter(i => i.contract_id === id && !i.posted).reduce((s, i) => s + Number(i.amount), 0);
  const act = rows.filter(r => r.status === "Active"), ending = act.filter(r => r.end_date <= soon), noacc = act.filter(r => !r.account_id);
  const st = sessionStorage.getItem("ctSt") || "", sv = sessionStorage.getItem("ctSv") || "";
  $("#view").innerHTML = `<h2>Contracts</h2><p style="color:var(--mut);margin-top:0">Service contracts and letters of acceptance for ICT support, CCTV, electrical and networking work. Activating a contract posts its charges to the client's credit account on their due dates.</p>
    <div class="cards"><div class="card"><small>Active contracts</small><b>${act.length}</b></div><div class="card"><small>Charged to accounts so far</small><b>KES ${kes(act.reduce((s, r) => s + charged(r.id), 0))}</b></div><div class="card"><small>Still to be charged</small><b>KES ${kes(act.reduce((s, r) => s + waiting(r.id), 0))}</b></div><div class="card"><small>Drafts</small><b>${rows.filter(r => r.status === "Draft").length}</b></div></div>
    ${ending.length || noacc.length ? `<div class="panel"><h3>Needs attention</h3><div class="attrow">${ending.map(r => `<div class="att">${esc(ctNo(r))} · ${esc(r.client_name)} ${r.end_date < today ? "ended" : "ends"} ${esc(r.end_date)}${r.billing !== "One-off" ? " — renew?" : ""}</div>`).join("")}${noacc.map(r => `<div class="att">${esc(ctNo(r))} · ${esc(r.client_name)} has no credit account, so nothing is being charged</div>`).join("")}</div></div>` : ""}
    <div class="bar"><input id="q" placeholder="Search contracts…"><select id="fst"><option value="">All statuses</option>${["Draft", "Active", "Completed", "Terminated"].map(s => `<option ${st === s ? "selected" : ""}>${s}</option>`).join("")}</select><select id="fsv"><option value="">All types</option>${CT_SERVICES.map(s => `<option ${sv === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      ${edit ? CT_SERVICES.map(s => `<button class="btn ${s === "ICT support contract" ? "" : "ghost"}" data-new="${esc(s)}">+ ${esc(s === "ICT support contract" ? "ICT support" : s)}</button>`).join("") : ""}</div>
    <div class="wrap"><table><thead><tr><th>No.</th><th>Client</th><th>Type</th><th>Value</th><th>Period</th><th>Charged</th><th>Status</th><th>Letter</th><th></th></tr></thead><tbody id="tb">${rows.map((r, i) => `<tr data-st="${esc(r.status)}" data-sv="${esc(r.service)}"><td><b>${esc(ctNo(r))}</b></td><td>${esc(r.client_name)}${r.site ? `<br><small>${esc(r.site)}</small>` : ""}${r.account_id ? `<br><small>Account: ${esc(accs[r.account_id] || "linked")}</small>` : `<br><small>no credit account</small>`}</td>
      <td>${esc(r.service)}<br><small>${esc(r.billing)}</small></td><td class="n">${kes(ctValue(r))}</td><td>${esc(r.start_date)}<br>to ${esc(r.end_date)}</td><td class="n">${kes(charged(r.id))}</td><td>${ctTag(r.status)}</td><td>${r.acceptance_no ? esc(r.acceptance_no) : `<small>–</small>`}</td>
      <td><button class="btn sm ghost" data-p="${i}">Contract</button> <button class="btn sm ghost" data-l="${i}">Letter</button> ${r.status === "Draft" && edit ? `<button class="btn sm ghost" data-e="${i}">Edit</button> ` : ""}${r.status === "Draft" && appr ? `<button class="btn sm" data-a="${i}">Activate</button> ` : ""}${r.status === "Active" && appr ? `<button class="btn sm ghost" data-x="${i}">End</button> ` : ""}${edit ? `<button class="btn sm ghost" data-r="${i}">Copy / renew</button> ` : ""}${r.status === "Draft" && edit ? `<button class="btn sm ghost" data-d="${i}">Delete</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="9" style="color:var(--mut)">No contracts yet. Start one with the buttons above.</td></tr>`}</tbody></table></div>`;
  const filt = () => { const t = $("#q").value.toLowerCase(), s = $("#fst").value, v = $("#fsv").value; sessionStorage.setItem("ctSt", s); sessionStorage.setItem("ctSv", v); document.querySelectorAll("#tb tr[data-st]").forEach(tr => tr.hidden = !(tr.textContent.toLowerCase().includes(t) && (!s || tr.dataset.st === s) && (!v || tr.dataset.sv === v))); };
  $("#q").oninput = $("#fst").onchange = $("#fsv").onchange = filt; filt();
  $("#view").onclick = async e => { const b = e.target.closest("button"); if (!b) return; const r = rows[b.dataset.p ?? b.dataset.l ?? b.dataset.e ?? b.dataset.a ?? b.dataset.x ?? b.dataset.r ?? b.dataset.d];
    if (b.dataset.new) contractDialog(null, b.dataset.new);
    else if (b.dataset.p !== undefined) printContract(r);
    else if (b.dataset.l !== undefined) printLetter(r);
    else if (b.dataset.e !== undefined) contractDialog(r);
    else if (b.dataset.r !== undefined) { const len = Math.round((new Date(r.end_date) - new Date(r.start_date)) / 864e5) + 1; const s = iso(new Date(new Date(r.end_date + "T12:00:00Z").getTime() + 864e5)); const ne = new Date(new Date(s + "T12:00:00Z").getTime() + (len - 1) * 864e5).toISOString().slice(0, 10); contractDialog({ ...r, id: null, contract_no: null, status: "Draft", acceptance_no: null, acceptance_date: null, start_date: s, end_date: ne, signed_on: null, milestones: (r.milestones || []).map(m => ({ ...m, due_on: m.due_on === r.start_date ? s : ne })), _copy: true }); }
    else if (b.dataset.a !== undefined) { const why = r.account_id ? "" : "\n\nThis client has no credit account, so nothing will be posted."; if (!confirm(`Activate ${ctNo(r)}? Its charges will be posted to the client's credit account on their due dates, and it can no longer be edited.${why}`)) return;
      const x = await db.rpc("contract_activate", { p_id: r.id }); if (x.error) return toast(x.error.message); toast(`${x.data.contract_no} is active. ${x.data.account ? x.data.posted + " charge(s) posted to the account now." : "No credit account, so nothing was posted."}`); contractsPage(); }
    else if (b.dataset.x !== undefined) endDialog(r);
    else if (b.dataset.d !== undefined) { if (!confirm(`Delete draft ${ctNo(r)}?`)) return; const x = await db.rpc("contract_delete", { p_id: r.id }); if (x.error) return toast(x.error.message); toast("Deleted"); contractsPage(); } };
}
async function contractPreview(r) { try { const x = await db.rpc("contract_preview", { p_id: r.id }); if (x && !x.error && x.data) return x.data; } catch (_) {} const s = ctSched(r); return { schedule: s, value: ctValue(r) }; }
async function printContract(r) { const p = await contractPreview(r); printHtml(contractHtml(r, p.schedule, p.value), `${ctNo(r)} ${r.service} contract - ${r.client_name}.pdf`); }
async function printLetter(r) {
  if (!r.acceptance_no && can("docs.void")) { const x = await db.rpc("contract_letter", { p_id: r.id }); if (x.error) return toast(x.error.message); r = { ...r, acceptance_no: x.data.acceptance_no, acceptance_date: x.data.acceptance_date }; contractsPageSoon(); }
  const p = await contractPreview(r); printHtml(letterHtml(r, p.schedule, p.value), `${r.acceptance_no || "Letter of acceptance"} ${r.client_name}.pdf`);
}
const contractsPageSoon = () => setTimeout(() => { if (location.hash.replace("#", "") === "contracts") contractsPage(); }, 400);
function endDialog(r) {
  const f = $("#dlgForm"); f.oninput = f.onchange = f.onclick = null;
  f.innerHTML = `<h2>End ${esc(ctNo(r))}</h2><div class="grid"><label>How is it ending<select name="st"><option value="Completed">Completed (the work or term is finished)</option><option value="Terminated">Terminated early</option></select></label><label class="full">Reason / note<input name="note"></label></div>
    <p style="color:var(--mut);font-size:13px">Charges already posted to the credit account stay (adjust them on the account if needed). Charges not yet due are removed.</p>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">End contract</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault(); const x = await db.rpc("contract_end", { p_id: r.id, p_status: f.elements.st.value, p_note: f.elements.note.value.trim() || null }); if (x.error) return toast(x.error.message); $("#dlg").close(); toast(`Ended. ${x.data.removed} future charge(s) removed.`); contractsPage(); };
  $("#dlg").showModal();
}

// ---- the form --------------------------------------------------------------------------------------------------------------------------
async function contractDialog(c, service) {
  const isNew = !c || !c.id, tpl0 = CT_TEMPLATES[(c && c.service) || service];
  const accs = can("accounts.view") ? (must(await db.from("credit_accounts").select("*").eq("active", true).order("name")) || []) : [];
  let quotes = []; try { quotes = must(await db.from("documents").select("id,doc_no,customer,contact,address,customer_pin,lpo_no,account_id,items,doc_type,status").eq("doc_type", "Quotation").order("id", { ascending: false }).limit(150)) || []; quotes = quotes.filter(q => q.status !== "Void"); } catch (_) {}
  const today = iso(new Date());
  const st = c && c.id ? JSON.parse(JSON.stringify(c)) : c && c._copy ? JSON.parse(JSON.stringify(c)) : (() => { const t = tpl0, s = today, months = t.months;
    return { service: service || "ICT support contract", billing: t.billing, account_id: null, client_name: "", client_contact: "", client_address: "", client_pin: "", client_rep: "", client_rep_title: "", our_rep: "Franklin Ntoruru", our_rep_title: "Director", lpo_no: "", quote_ref: "", site: "",
      start_date: s, end_date: months ? ctEndFor(s, months) : ctAddMonths(s, 1), fee: "", payment_days: t.payment_days, scope: t.scope, clauses: JSON.parse(JSON.stringify(t.clauses)), items: JSON.parse(JSON.stringify(t.items)),
      milestones: t.milestones.map(m => ({ label: m.label, pct: m.pct, due_on: m.when === "end" ? ctAddMonths(s, 1) : s })), notes: "" }; })();
  st.items = st.items || []; st.clauses = st.clauses || []; st.milestones = st.milestones || [];
  const f = $("#dlgForm"); f.oninput = f.onchange = f.onclick = null; const dlg = $("#dlg"); dlg.style.width = "min(980px, 96vw)"; dlg.addEventListener("close", () => { dlg.style.width = ""; }, { once: true });
  const inp = (n, l, v, extra = "") => `<label>${l}<input name="${n}" value="${esc(v ?? "")}" ${extra}></label>`;
  f.innerHTML = `<h2>${isNew ? (c && c._copy ? "Copy / renew contract" : "New contract") : "Edit " + esc(ctNo(c))}</h2><p style="color:var(--mut);margin:0 0 8px">${esc(CT_BLURB[st.service] || "")}</p>
    <div class="grid"><label>Type<select name="service">${CT_SERVICES.map(s => `<option ${st.service === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label>Credit account (charges are posted here)<select name="account_id"><option value="">No credit account (nothing is posted)</option>${accs.map(a => `<option value="${a.id}" ${String(st.account_id) === String(a.id) ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
      ${quotes.length ? `<label class="full">Fill from a quotation<select name="quote"><option value="">— choose —</option>${quotes.map(q => `<option value="${q.id}">${esc(q.doc_no)} · ${esc(q.customer || "")}</option>`).join("")}</select></label>` : ""}
      ${inp("client_name", "Client name", st.client_name, "required")}${inp("site", "Site / premises (shown on the documents)", st.site, 'placeholder="e.g. Sanitas Family Hospital, Meru"')}
      ${inp("client_address", "Client address", st.client_address)}${inp("client_contact", "Client phone / email", st.client_contact)}${inp("client_pin", "Client KRA PIN", st.client_pin)}${inp("lpo_no", "Client LPO / PO no.", st.lpo_no)}
      ${inp("client_rep", "Client signatory (name)", st.client_rep)}${inp("client_rep_title", "Client signatory (title)", st.client_rep_title)}${inp("our_rep", "Our signatory (name)", st.our_rep)}${inp("our_rep_title", "Our signatory (title)", st.our_rep_title)}
      ${inp("quote_ref", "Our quotation no. (optional)", st.quote_ref)}
      <label>Billing<select name="billing">${["Monthly", "Yearly", "One-off"].map(b => `<option ${st.billing === b ? "selected" : ""}>${b === "One-off" ? "One-off (project, paid in stages)" : b}</option>`).join("")}</select></label>
      <label>Start date<input name="start_date" type="date" value="${esc(st.start_date)}" required></label>
      <label data-rc>Length (months)<input name="months" type="number" min="1" max="120" step="1" value="${st.billing !== "One-off" && st.start_date && st.end_date ? Math.max(1, Math.round((new Date(st.end_date) - new Date(st.start_date)) / 2629800000)) : 12}"></label>
      <label>End / completion date<input name="end_date" type="date" value="${esc(st.end_date)}" required></label>
      <label data-rc>Fee per period (KES)<input name="fee" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(st.billing !== "One-off" ? st.fee : "")}"></label>
      <label>Payable within (days)<input name="payment_days" type="number" min="0" max="180" step="1" value="${esc(st.payment_days)}"></label></div>
    <h3>Scope of the services</h3><label class="full"><textarea name="scope" rows="9" style="width:100%">${esc(st.scope)}</textarea></label><p style="color:var(--mut);font-size:13px;margin:2px 0">Fill in everything in [square brackets]; a contract with brackets left cannot be activated or have its letter issued.</p>
    <h3 id="ihead">Items</h3><div id="items"></div><div class="bar"><button class="btn sm ghost" type="button" data-addi>+ Add a line</button></div>
    <div id="mwrap"><h3>Payment stages</h3><div id="ms"></div><div class="bar"><button class="btn sm ghost" type="button" data-addm>+ Add a stage</button></div></div>
    <div id="sched" class="panel"></div>
    <h3>Terms and clauses</h3><div id="cl"></div><div class="bar"><button class="btn sm ghost" type="button" data-addc>+ Add a clause</button><button class="btn sm ghost" type="button" data-reset>Reset wording to the ${esc(st.service)} template</button></div>
    <label class="full">Internal notes (not printed)<input name="notes" value="${esc(st.notes || "")}"></label>
    <div class="bar" style="margin-top:14px"><button class="btn" value="save">Save draft</button><button class="btn ghost" value="cancel" formnovalidate>Cancel</button></div>`;
  const el = f.elements, rc = () => el.billing.value.startsWith("Monthly") || el.billing.value.startsWith("Yearly");
  const bill = () => el.billing.value.split(" ")[0];
  const read = () => ({ billing: bill(), start_date: el.start_date.value, end_date: el.end_date.value, fee: el.fee.value, items: st.items, milestones: st.milestones });
  const drawI = () => { const one = !rc(); $("#ihead").textContent = one ? "Schedule of items and prices" : "Covered equipment and sites"; $("#items").innerHTML = st.items.map((i, k) => `<div class="grid" style="grid-template-columns:${one ? "3fr 70px 120px 90px" : "1fr"} auto;align-items:end"><label>${k ? "" : "Description"}<input data-i="${k}" data-k="desc" value="${esc(i.desc)}"></label>${one ? `<label>${k ? "" : "Qty"}<input data-i="${k}" data-k="qty" type="number" min="0" step="any" value="${esc(i.qty)}"></label><label>${k ? "" : "Unit price"}<input data-i="${k}" data-k="price" type="number" min="0" step="0.01" value="${esc(i.price)}"></label><span class="n" data-line="${k}">${kes((Number(i.qty) || 0) * (Number(i.price) || 0))}</span>` : ""}<button class="btn sm ghost" type="button" data-deli="${k}">×</button></div>`).join(""); };
  const drawM = () => { $("#mwrap").hidden = rc(); $("#ms").innerHTML = st.milestones.map((m, k) => `<div class="grid" style="grid-template-columns:2fr 90px 160px auto;align-items:end"><label>${k ? "" : "Stage"}<input data-m="${k}" data-k="label" value="${esc(m.label)}"></label><label>${k ? "" : "% of price"}<input data-m="${k}" data-k="pct" type="number" min="0" max="100" step="any" value="${esc(m.pct)}"></label><label>${k ? "" : "Due on"}<input data-m="${k}" data-k="due_on" type="date" value="${esc(m.due_on || "")}"></label><button class="btn sm ghost" type="button" data-delm="${k}">×</button></div>`).join("") + (() => { const t = st.milestones.reduce((s, m) => s + (Number(m.pct) || 0), 0); return st.milestones.length ? `<p style="margin:2px 0;font-size:13px;color:${Math.abs(t - 100) < 0.001 ? "#067647" : "#b42318"}">Stages add up to ${t}% ${Math.abs(t - 100) < 0.001 ? "" : "— must be 100%"}</p>` : ""; })(); };
  const drawS = () => { const c2 = read(), s = ctSched(c2); document.querySelectorAll("[data-rc]").forEach(x => x.hidden = !rc()); $("#sched").innerHTML = `<b>Payment schedule</b> <small style="color:var(--mut)">(charged to the credit account on these dates)</small>${s.length ? `<table><tbody>${s.slice(0, 14).map(x => `<tr><td>${esc(x.due_on)}</td><td>${esc(x.label)}</td><td class="n">${kes(x.amount)}</td></tr>`).join("")}${s.length > 14 ? `<tr><td colspan="3"><small>…and ${s.length - 14} more</small></td></tr>` : ""}<tr style="font-weight:700"><td colspan="2">Total</td><td class="n">${kes(ctValue(c2))}</td></tr></tbody></table>` : `<p style="margin:4px 0;color:var(--mut)">Enter the fee (or priced items) to see the schedule.</p>`}`; };
  const drawC = () => { $("#cl").innerHTML = st.clauses.map((x, k) => `<div style="margin-bottom:8px"><div class="bar" style="margin:0"><input data-c="${k}" data-k="h" value="${esc(x.h)}" placeholder="Heading" style="flex:1;font-weight:600"><button class="btn sm ghost" type="button" data-delc="${k}">×</button></div><textarea data-c="${k}" data-k="t" rows="3" style="width:100%">${esc(x.t)}</textarea></div>`).join(""); };
  const draw = () => { drawI(); drawM(); drawC(); drawS(); }; draw();
  f.oninput = e => { const t = e.target;
    if (t.dataset.i !== undefined) { st.items[t.dataset.i][t.dataset.k] = t.value; const ln = f.querySelector(`[data-line="${t.dataset.i}"]`); if (ln) ln.textContent = kes((Number(st.items[t.dataset.i].qty) || 0) * (Number(st.items[t.dataset.i].price) || 0)); drawS(); }
    else if (t.dataset.m !== undefined) { st.milestones[t.dataset.m][t.dataset.k] = t.value; if (t.dataset.k !== "label") { drawS(); const tot = st.milestones.reduce((s, m) => s + (Number(m.pct) || 0), 0), p = $("#ms").lastElementChild; if (p && p.tagName === "P") { p.textContent = `Stages add up to ${tot}% ${Math.abs(tot - 100) < 0.001 ? "" : "— must be 100%"}`; p.style.color = Math.abs(tot - 100) < 0.001 ? "#067647" : "#b42318"; } } }
    else if (t.dataset.c !== undefined) st.clauses[t.dataset.c][t.dataset.k] = t.value;
    else if (t.name === "fee" || t.name === "start_date" || t.name === "end_date") { if (t.name !== "end_date" && rc() && el.months.value) el.end_date.value = ctEndFor(el.start_date.value, Number(el.months.value)); drawS(); }
    else if (t.name === "months" && el.start_date.value && Number(t.value) > 0) { el.end_date.value = ctEndFor(el.start_date.value, Number(t.value)); drawS(); } };
  f.onchange = e => { const t = e.target;
    if (t.name === "billing") { if (rc()) { el.end_date.value = ctEndFor(el.start_date.value, Number(el.months.value) || 12); } draw(); }
    else if (t.name === "account_id") { const a = accs.find(x => String(x.id) === t.value); if (a) { if (!el.client_name.value) el.client_name.value = a.name; if (!el.client_address.value) el.client_address.value = a.address || ""; if (!el.client_contact.value) el.client_contact.value = [a.contact_person, a.phone, a.email].filter(Boolean).join(", "); if (!el.client_pin.value) el.client_pin.value = a.kra_pin || ""; if (!el.client_rep.value) el.client_rep.value = a.contact_person || ""; } }
    else if (t.name === "service") { const tp = CT_TEMPLATES[t.value]; if (isNew && confirm(`Load the ${t.value} wording (scope, items, clauses, payment stages)? This replaces what is in the form now.`)) loadTpl(t.value); else if (!isNew) toast("The type changed; the wording stays as it is. Use “Reset wording” to load the template."); $("#dlgForm h2 + p").textContent = CT_BLURB[t.value] || ""; }
    else if (t.name === "quote") { const q = quotes.find(x => String(x.id) === t.value); if (!q) return; el.quote_ref.value = q.doc_no; if (!el.client_name.value) el.client_name.value = q.customer || ""; if (!el.client_address.value) el.client_address.value = q.address || ""; if (!el.client_contact.value) el.client_contact.value = q.contact || ""; if (!el.client_pin.value) el.client_pin.value = q.customer_pin || ""; if (!el.lpo_no.value) el.lpo_no.value = q.lpo_no || "";
      if (q.account_id && accs.find(a => a.id === q.account_id)) el.account_id.value = String(q.account_id);
      if (!rc()) { st.items = (q.items || []).map(i => ({ desc: i.desc, qty: i.qty, price: i.price })); } draw(); } };
  const loadTpl = name => { const t = CT_TEMPLATES[name]; el.scope.value = t.scope; st.clauses = JSON.parse(JSON.stringify(t.clauses)); if (!st.items.some(i => Number(i.price) > 0)) st.items = JSON.parse(JSON.stringify(t.items)); st.milestones = t.milestones.map(m => ({ label: m.label, pct: m.pct, due_on: m.when === "end" ? el.end_date.value : el.start_date.value })); const b = t.billing === "One-off" ? "One-off (project, paid in stages)" : t.billing; [...el.billing.options].forEach(o => o.selected = o.text === b); el.payment_days.value = t.payment_days; if (t.months) el.end_date.value = ctEndFor(el.start_date.value, t.months); draw(); };
  f.onclick = e => { const b = e.target.closest("button[type=button]"); if (!b) return;
    if (b.dataset.addi !== undefined) { st.items.push({ desc: "", qty: 1, price: 0 }); drawI(); drawS(); }
    else if (b.dataset.deli !== undefined) { st.items.splice(b.dataset.deli, 1); drawI(); drawS(); }
    else if (b.dataset.addm !== undefined) { st.milestones.push({ label: "", pct: 0, due_on: el.end_date.value }); drawM(); drawS(); }
    else if (b.dataset.delm !== undefined) { st.milestones.splice(b.dataset.delm, 1); drawM(); drawS(); }
    else if (b.dataset.addc !== undefined) { st.clauses.push({ h: "", t: "" }); drawC(); }
    else if (b.dataset.delc !== undefined) { st.clauses.splice(b.dataset.delc, 1); drawC(); }
    else if (b.dataset.reset !== undefined) { if (confirm(`Replace the scope and clauses with the standard ${el.service.value} wording?`)) { loadTpl(el.service.value); } } };
  f.onsubmit = async e => { if (e.submitter.value !== "save") return; e.preventDefault();
    const one = !rc(), p = { service: el.service.value, billing: bill(), account_id: el.account_id.value || null, client_name: el.client_name.value, client_contact: el.client_contact.value, client_address: el.client_address.value, client_pin: el.client_pin.value, client_rep: el.client_rep.value, client_rep_title: el.client_rep_title.value,
      our_rep: el.our_rep.value, our_rep_title: el.our_rep_title.value, lpo_no: el.lpo_no.value, quote_ref: el.quote_ref.value, site: el.site.value, start_date: el.start_date.value, end_date: el.end_date.value, payment_days: Number(el.payment_days.value) || 30, scope: el.scope.value, notes: el.notes.value,
      clauses: st.clauses.filter(x => String(x.h || "").trim() || String(x.t || "").trim()), items: st.items.filter(i => String(i.desc || "").trim()).map(i => ({ desc: i.desc.trim(), qty: Number(i.qty) || 0, price: Number(i.price) || 0 })),
      milestones: one ? st.milestones.map(m => ({ label: m.label, pct: Number(m.pct) || 0, due_on: m.due_on || null })) : [] };
    if (!one) p.fee = Number(el.fee.value) || 0;
    const x = await db.rpc("contract_save", { p_id: isNew ? null : c.id, p }); if (x.error) return toast(x.error.message);
    $("#dlg").close(); toast(`Saved as ${x.data.contract_no} (draft). Check it, then Activate it to start charging.`); contractsPage(); };
  dlg.showModal();
}
