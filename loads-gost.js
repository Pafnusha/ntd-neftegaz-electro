/* gost-drawing engine for loads module: mm sheet, ESKD DXF (cp1251), ГОСТ symbols */
"use strict";
function Lerp(a, b, t) { return a + (b - a) * t; }
function wEst(str, size) { return String(str).length * (size || 7) * 0.56; }
function wrapTxt(s, maxc) {
  const words = String(s).split(/\s+/); const out = []; let ln = "";
  for (const w of words) { if ((ln + " " + w).trim().length > maxc) { if (ln) out.push(ln.trim()); ln = w; } else ln += " " + w; }
  if (ln.trim()) out.push(ln.trim()); return out;
}
function mmSheet(P) {
  const GOST = [2.5, 3.5, 5, 7];
  const snap = (v) => (v <= 2.95 ? 2.5 : v <= 3.9 ? 3.5 : v <= 5.5 ? 5 : 7);
  const K = 0.5;
  for (const e of P.els) {
    for (const k of ["x", "y", "x1", "y1", "x2", "y2", "w", "h", "r"]) if (typeof e[k] === "number") e[k] = +(e[k] * K).toFixed(2);
    if (e.t === "p" && e.pts) e.pts = e.pts.map(pt => [+(pt[0] * K).toFixed(2), +(pt[1] * K).toFixed(2)]);
    if (e.t === "t") e.size = snap(+((e.size || 7) * K).toFixed(2));
    if (typeof e.sw === "number") e.sw = +(e.sw * K).toFixed(3);
  }
  P.W = +(P.W * K).toFixed(1);
  const tx = P.els.filter(z => z.t === "t" && z.s);
  const bb = (a) => { const w = String(a.s).length * a.size * 0.75; let x0 = a.x; if (a.align === "middle") x0 -= w / 2; else if (a.align === "end") x0 -= w; return { x0, y0: a.y - a.size, x1: x0 + w, y1: a.y + a.size * 0.3 }; };
  const move = (a, dx, dy) => { a.x = +(a.x + dx).toFixed(2); if (a.align === "middle") a.x = +(a.x - dx / 2).toFixed(2); if (a.align === "end") a.x = +(a.x - dx).toFixed(2); a.y = +(a.y + dy).toFixed(2); };
  for (let sweep = 0; sweep < 40; sweep++) {
    let moved = false;
    for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) {
      const a = bb(tx[i]), b = bb(tx[j]);
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ox > 0.3 && oy > 0.3) {
        if (oy <= ox) { const dn = a.y0 < b.y0 ? tx[j] : tx[i]; move(dn, 0, oy + 0.8); }
        else { const pair = tx[i].x <= tx[j].x ? [tx[i], tx[j]] : [tx[j], tx[i]]; move(pair[1], ox + 0.8, 0); }
        moved = true;
      }
    }
    if (!moved) break;
  }
  P.H = +(Math.max(P.H, ...tx.map(a => bb(a).y1)) + 10).toFixed(1);
  return P;
}
function prims2svg(P, k) {
  const K = k || 1;
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${P.W} ${P.H}" width="${(P.W * K).toFixed(0)}" height="${(P.H * K).toFixed(0)}" font-family="Segoe UI,Arial, sans-serif">`;
  o += `<rect x="0" y="0" width="${P.W}" height="${P.H}" fill="white"/>`;
  for (const e of P.els) {
    if (e.t === "l") o += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="${e.color || '#223344'}" stroke-width="${e.sw || 1.2}" ${e.dash ? `stroke-dasharray="${e.dash}"` : ""}/>`;
    else if (e.t === "r") o += `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="${e.fill || 'none'}" stroke="${e.stroke || '#223344'}" stroke-width="${e.sw || 1.2}" rx="${e.rx || 0}"/>`;
    else if (e.t === "c") o += e.color2 ? `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="${e.color2}"/>` : `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="none" stroke="${e.color || '#223344'}" stroke-width="1.2"/>`;
    else if (e.t === "n") o += `<circle cx="${e.x}" cy="${e.y}" r="${e.r || 2.2}" fill="${e.color || '#223344'}"/>`;
    else if (e.t === "p") o += `<polygon points="${e.pts.map(pt => pt.join(',')).join(' ')}" fill="none" stroke="${e.color || '#223344'}" stroke-width="1.2"/>`;
    else if (e.t === "t") {
      const sz = e.size || 9, txt = String(e.s || "").replace(/\n/g, "  ·  ").replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const wf = 0.72, w = txt.length * sz * wf;
      let ax = e.x; if (e.align === "middle") ax = e.x - w / 2; else if (e.align === "end") ax = e.x - w;
      o += `<text transform="translate(${ax.toFixed(2)} ${e.y}) scale(${wf} 1)" x="0" y="0" font-size="${sz}" font-weight="${e.bold ? 700 : 400}" fill="${e.color || '#223344'}">${txt}</text>`;
    }
  }
  return o + "</svg>";
}
/* ---- DXF R12, Windows-1251, стиль ESKD (eskd.shx ГОСТ 2.1.115) ---- */
const CP1251 = (() => {
  const m = {};
  "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("").forEach((c, i) => { m[c] = 0xC0 + i; });
  "абвгдежзийклмнопрстуфхцчшщъыьэюя".split("").forEach((c, i) => { m[c] = 0xE0 + i; });
  m["Ё"] = 0xA8; m["ё"] = 0xB8; m["°"] = 0xB0; m["±"] = 0xB1; m["·"] = 0xB7; m["№"] = 0xB9; m["«"] = 0xAB; m["»"] = 0xBB;
  return m;
})();
const DXF_TRANS = (() => {
  const m = {};
  m["—"] = "-"; m["–"] = "-"; m["‘"] = "'"; m["’"] = "'"; m["“"] = "\""; m["”"] = "\""; m["…"] = "...";
  m["→"] = "->"; m["←"] = "<-"; m["≤"] = "<="; m["≥"] = ">="; m["≈"] = "~"; m["×"] = "x"; m["÷"] = "/"; m["⎓"] = "="; m["−"] = "-";
  m["α"] = "a"; m["η"] = "n"; m["φ"] = "f"; m["π"] = "p"; m["Σ"] = "S"; m["Δ"] = "D"; m["Ω"] = "Om"; m["µ"] = "u"; m["²"] = "2"; m["√"] = "kv.";
  m["§"] = "p."; m["•"] = "-";
  return m;
})();
function dxfSanitize(str) {
  let out = "";
  for (const ch of String(str)) {
    const c = ch.codePointAt(0);
    if (c === 10 || c === 13 || c === 59) out += " ";
    else if (c < 127) out += ch;
    else if (DXF_TRANS[ch] !== undefined) out += DXF_TRANS[ch];
    else if (CP1251[ch] !== undefined) out += ch;
    else out += "?";
  }
  return out;
}
function dxfBytes(str) {
  const a = [];
  for (const ch of str) { const c = ch.codePointAt(0); a.push(c < 127 ? c : (CP1251[ch] !== undefined ? CP1251[ch] : 0x3F)); }
  return new Uint8Array(a);
}
function prims2dxf(P) {
  const H = P.H, y = (v) => (H - v).toFixed(2);
  let o = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$DWGCODEPAGE\n3\nANSI_1251\n0\nENDSEC\n";
  o += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0\n0\nENDTAB\n0\nTABLE\n2\nSTYLE\n70\n2\n0\nSTYLE\n2\nSTANDARD\n70\n0\n40\n0\n41\n1\n50\n0\n71\n0\n42\n2.5\n3\ntxt\n4\n\n0\nSTYLE\n2\nESKD\n70\n0\n40\n0\n41\n0.7\n50\n0\n71\n0\n42\n3.5\n3\neskd.shx\n4\n\n0\nENDTAB\n0\nTABLE\n2\nLAYER\n70\n2\n0\nLAYER\n2\nSCHEME\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nLAYER\n2\nTEXT\n70\n0\n62\n3\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
  for (const e of P.els) {
    if (e.t === "l") o += `0\nLINE\n8\nSCHEME\n10\n${e.x1.toFixed(2)}\n20\n${y(e.y1)}\n30\n0\n11\n${e.x2.toFixed(2)}\n21\n${y(e.y2)}\n31\n0\n`;
    else if (e.t === "r") {
      const c = [[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]];
      for (let i = 0; i < 4; i++) { const q = c[i], r2 = c[(i + 1) % 4];
        o += `0\nLINE\n8\nSCHEME\n10\n${q[0].toFixed(2)}\n20\n${y(q[1])}\n30\n0\n11\n${r2[0].toFixed(2)}\n21\n${y(r2[1])}\n31\n0\n`; }
    } else if (e.t === "c" || e.t === "n") o += `0\nCIRCLE\n8\nSCHEME\n10\n${e.x.toFixed(2)}\n20\n${y(e.y)}\n30\n0\n40\n${(e.r || 2.2).toFixed(2)}\n`;
    else if (e.t === "p") { const q = e.pts;
      for (let i = 0; i < q.length; i++) { const a2 = q[i], r2 = q[(i + 1) % q.length];
        o += `0\nLINE\n8\nSCHEME\n10\n${a2[0].toFixed(2)}\n20\n${y(a2[1])}\n30\n0\n11\n${r2[0].toFixed(2)}\n21\n${y(r2[1])}\n31\n0\n`; } }
    else if (e.t === "t") {
      const sz = +(e.size || 3.5).toFixed(2);
      const txt = dxfSanitize(e.s || "");
      const wE = txt.length * sz * 0.74 + 2;
      let tx = e.x;
      if (e.align === "middle") tx -= wE / 2; else if (e.align === "end") tx -= wE;
      o += `0\nTEXT\n8\nTEXT\n10\n${tx.toFixed(2)}\n20\n${(y(e.y) - sz * 0.2).toFixed(2)}\n30\n0\n40\n${sz}\n41\n1\n7\nESKD\n1\n${txt}\n`;
    }
  }
  return o + "0\nENDSEC\n0\nEOF\n";
}
function dxfBlobSheet(P) { return new Blob([dxfBytes(prims2dxf(P))], { type: "application/dxf" }); }
/* --- символы (px-домен листа, до mmSheet) --- */
function symQL(P, x, y, pos, inf) { /* выключатель нагрузки/предохр. """
  P.els.push({ t: "l", x1: x, y1: y - 12, x2: x, y2: y + 12, sw: 1.4 });
  P.els.push({ t: "l", x1: x - 4, y1: y + 4, x2: x + 4, y2: y - 6, sw: 1.6 });
  P.els.push({ t: "c", x: x - 4, y: y + 5, r: 1.4 });
  P.els.push({ t: "t", x: x + 10, y: y - 8, s: pos, size: 7, bold: true });
  if (inf) P.els.push({ t: "t", x: x + 10, y: y + 2, s: inf, size: 5.6, color: "#33465e" });
}
function symTR(P, x, y, pos, inf) { /* силовой трансформатор: две пересекающиеся окружности (ГОСТ 2.746) */
  P.els.push({ t: "c", x: x - 8, y, r: 14 });
  P.els.push({ t: "c", x: x + 8, y, r: 14 });
  P.els.push({ t: "t", x: x - 2, y: y + 4, s: pos, size: 7, bold: true, align: "end" });
  let yy = y + 30;
  (Array.isArray(inf) ? inf : inf ? [inf] : []).forEach(ln => { P.els.push({ t: "t", x: x + 26, y: yy, s: ln, size: 5.6, color: "#33465e" }); yy += 10; });
}
function dimH(P, x1, x2, y, label) {
  P.els.push({ t: "l", x1, y1: y, x2, y2: y, sw: 0.7, color: "#5a6a7e" });
  for (const [cx, d] of [[x1, 1], [x2, -1]]) {
    P.els.push({ t: "l", x1: cx - d * 7, y1: y - 2, x2: cx, y2: y, sw: 0.9, color: "#5a6a7e" });
    P.els.push({ t: "l", x1: cx - d * 7, y1: y + 2, x2: cx, y2: y, sw: 0.9, color: "#5a6a7e" });
    P.els.push({ t: "l", x1: cx, y1: y - 4, x2: cx, y2: y + 4, sw: 0.7, color: "#5a6a7e" });
  }
  const mx = (x1 + x2) / 2;
  const wf = 0.72, w = String(label).length * 7 * wf;
  P.els.push({ t: "t", x: mx + w * (1 - wf) / 2 / 1, y: y - 1.5, s: label, size: 7, color: "#33465e", align: "middle" });
}
function dimV(P, x, y1, y2, label) {
  P.els.push({ t: "l", x1: x, y1: y2, x2: x, y2: y1, sw: 0.7, color: "#5a6a7e" });
  for (const [cy, d] of [[y1, -1], [y2, 1]]) {
    P.els.push({ t: "l", x1: x - 2, y1: cy - d * 7, x2: x, y2: cy, sw: 0.9, color: "#5a6a7e" });
    P.els.push({ t: "l", x1: x + 2, y1: cy - d * 7, x2: x, y2: cy, sw: 0.9, color: "#5a6a7e" });
    P.els.push({ t: "l", x1: x - 4, y1: cy, x2: x + 4, y2: cy, sw: 0.7, color: "#5a6a7e" });
  }
  P.els.push({ t: "t", x: x - 3, y: (y1 + y2) / 2 + 2, s: label, size: 7, color: "#33465e", align: "end" });
}
