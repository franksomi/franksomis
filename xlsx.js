// Minimal .xlsx reader (no libraries): reads sheets as rows of values. Used only by the owner's history import.
// An .xlsx is a zip of XML files; the browser unzips each one with DecompressionStream.
const XLSXMini = (() => {
  const td = new TextDecoder();
  async function inflate(bytes) {
    const ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(bytes); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  async function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf); let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65600); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("This is not an .xlsx file.");
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("The file is damaged.");
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      files[name] = { method, csize, off };
    }
    const get = async name => {
      const f = files[name]; if (!f) return null;
      const lh = f.off, ln = dv.getUint16(lh + 26, true), lx = dv.getUint16(lh + 28, true), start = lh + 30 + ln + lx, data = u8.subarray(start, start + f.csize);
      return td.decode(f.method === 0 ? data : await inflate(data));
    };
    return { get, names: Object.keys(files) };
  }
  const xml = s => new DOMParser().parseFromString(s, "application/xml");
  const colIdx = ref => { let n = 0; for (const ch of ref.replace(/[0-9]/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
  const iso = serial => { const d = new Date(Math.round((Number(serial) - 25569) * 86400000)); return d.toISOString().slice(0, 10); };
  async function read(buf) {
    const z = await unzip(buf);
    const wb = xml(await z.get("xl/workbook.xml")), rels = xml(await z.get("xl/_rels/workbook.xml.rels"));
    const relTo = {}; rels.querySelectorAll("Relationship").forEach(r => relTo[r.getAttribute("Id")] = r.getAttribute("Target"));
    const ss = []; const sst = await z.get("xl/sharedStrings.xml");
    if (sst) xml(sst).querySelectorAll("si").forEach(si => ss.push([...si.querySelectorAll("t")].map(t => t.textContent).join("")));
    const dateXf = []; const sty = await z.get("xl/styles.xml");
    if (sty) {
      const sx = xml(sty), custom = {}; sx.querySelectorAll("numFmts > numFmt").forEach(f => custom[f.getAttribute("numFmtId")] = f.getAttribute("formatCode"));
      sx.querySelectorAll("cellXfs > xf").forEach(xf => { const id = Number(xf.getAttribute("numFmtId")), code = (custom[id] || "").replace(/"[^"]*"|\[[^\]]*\]|\\./g, ""); dateXf.push(BUILTIN_DATE.has(id) || (custom[id] && /[dmy]/i.test(code) && !/[#0]/.test(code))); });
    }
    const out = {};
    for (const sh of wb.querySelectorAll("sheets > sheet")) {
      const rid = sh.getAttribute("r:id") || sh.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      let target = relTo[rid] || ""; target = target.startsWith("/") ? target.slice(1) : "xl/" + target;
      const text = await z.get(target); if (!text) continue;
      const rows = [];
      xml(text).querySelectorAll("sheetData > row").forEach(r => {
        const arr = [];
        r.querySelectorAll("c").forEach(c => {
          const t = c.getAttribute("t"), v = c.querySelector("v"), ix = colIdx(c.getAttribute("r") || "A1");
          let val = null;
          if (t === "s") val = v ? ss[Number(v.textContent)] : null;
          else if (t === "inlineStr") val = [...c.querySelectorAll("t")].map(x => x.textContent).join("");
          else if (t === "str" || t === "e") val = v ? v.textContent : null;
          else if (t === "b") val = v ? v.textContent === "1" : null;
          else if (v && v.textContent !== "") { const num = Number(v.textContent); val = dateXf[Number(c.getAttribute("s") || 0)] ? iso(num) : num; }
          arr[ix] = val === undefined ? null : val;
        });
        rows[Number(r.getAttribute("r")) - 1] = Array.from(arr, x => x === undefined ? null : x);
      });
      out[sh.getAttribute("name")] = Array.from(rows, r => r || []);
    }
    return out;
  }
  return { read };
})();
