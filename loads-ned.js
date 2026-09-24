/* loads-ned.js — выбор кабеля по базе NED-Plagum (engine/data калькулятора кабелей)
   и печать листа схемы в PDF (A1 ландшафт, офлайн-мини-генератор). */
"use strict";
function nedSelectCable(Ir, L, phases, cosPhi, opts) {
  try {
    var E = window.Eng, D = window.DATA;
    if (!E || !D || !D.lvIec) return null;
    var o = opts || {};
    var line = {
      mat: "cu", vclass: "0.4", method: o.underground ? "earth_trench" : "air_ladder",
      src: "IEC-LV", ph: phases === 1 ? "1" : "3",
      cores: phases === 1 ? 2 : 4,
      Ifix: Ir, cos: cosPhi || 0.8, L: L || 30,
      Tair: o.Tair != null ? o.Tair : 30, Tsoil: o.Tsoil != null ? o.Tsoil : 15,
      allowedPct: o.du != null ? o.du : 5, nParallel: 1
    };
    var r = E.selectLine(line, { thetaJob: 90 });
    var b = r && r.best;
    if (!b) return { none: true, need: r && r.Kneed };
    return { s: b.s, cores: line.cores, Idp: b.Idp, kT: b.kT, kGrp: b.kGrp, dU: b.dU && b.dU.pct,
      via: b.note || "NED-Plagum · IEC-60364-5-52 табл.1 (медь, лоток)", Ir: r.IrA, type: "ВВГнг(А)-LS" };
  } catch (e) { return null; }
}
function byteLen(s) { var c = 0; for (var j = 0; j < s.length; j++) { var cc = s.charCodeAt(j); c += cc < 0x80 ? 1 : (cc < 0x800 ? 2 : 3); } return c; }
function pdfEsc(s) { return String(s).replace(/[()\\]/g, function (c) { return "\\" + c; }).replace(/[^\x20-\x7E]/g, " "); }
function pdfFromImageJpeg(jpegBytes, wPx, hPx, title) {
  var pw = 1190.55, ph = 841.89, margin = 16;
  var k = Math.min((pw - 2 * margin) / wPx, (ph - 2 * margin) / hPx);
  var w = wPx * k, h = hPx * k, ox = (pw - w) / 2, oy = (ph - h) / 2;
  var content = "q 1 0 0 1 0 0 cm BT /F1 8 Tf 40 " + (ph - 26) + " Td (" + pdfEsc(title || "Uninterruptible single-line scheme (ESKD)") + ") Tj ET Q\n"
    + "q " + w.toFixed(2) + " 0 0 " + h.toFixed(2) + " " + ox.toFixed(2) + " " + oy.toFixed(2) + " cm /Im0 Do Q\n";
  var objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pw.toFixed(2) + " " + ph.toFixed(2) + "] /Resources << /XObject << /Im0 4 0 R >> /Font << /F1 6 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /XObject /Subtype /Image /Width " + wPx + " /Height " + hPx + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpegBytes.length + " >>\nstream\n",
    "<< /Length " + byteLen(content) + " >>\nstream\n" + content + "endstream\n",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  ];
  var out = [];
  out.push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  var len = byteLen(out[0]);
  var offs = [];
  for (var n = 0; n < 6; n++) {
    offs[n] = len;
    var body = (n + 1) + " 0 obj\n" + objs[n];
    if (n === 3) {
      body += ""; /* stream за заголовком — данные вставим отдельно */
      out.push(body); len += byteLen(body);
      out.push({ img: true }); len += jpegBytes.length;
      var tail = "\nendstream\nendobj\n"; out.push(tail); len += byteLen(tail);
      continue;
    }
    body += (n === 4 ? "" : "\n") + "endobj\n";
    if (n === 1 || n === 2 || n === 5) body = (n + 1) + " 0 obj\n" + objs[n] + "\nendobj\n";
    if (n === 0) body = "1 0 obj\n" + objs[0] + "\nendobj\n";
    out.push(body); len += byteLen(body);
  }
  var xref = "xref\n0 7\n0000000000 65535 f \n";
  offs.forEach(function (o) { xref += ("0000000000" + o).slice(-10) + " 00000 n \n"; });
  xref += "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n" + len + "\n%%EOF\n";
  var total = len + byteLen(xref);
  var arr = new Uint8Array(total), pos = 0;
  function putStr(s) { for (var j = 0; j < s.length; j++) { var c = s.charCodeAt(j); if (c < 0x80) arr[pos++] = c; else if (c < 0x800) { arr[pos++] = 0xC0 | (c >> 6); arr[pos++] = 0x80 | (c & 63); } else { arr[pos++] = 0xE0 | (c >> 12); arr[pos++] = 0x80 | ((c >> 6) & 63); arr[pos++] = 0x80 | (c & 63); } } }
  out.forEach(function (s) { if (s && s.img) { arr.set(jpegBytes, pos); pos += jpegBytes.length; } else putStr(s); });
  putStr(xref);
  return arr;
}
function svgSheetToJpeg(P, scale, cb) {
  var svgTxt = prims2svg(P, 1);
  var img = new Image();
  img.onload = function () {
    var c = document.createElement("canvas");
    var ratio = Math.min(5, Math.max(1.5, 3200 / P.W));
    var r2 = (scale || ratio) ;
    c.width = Math.round(P.W * r2); c.height = Math.round(P.H * r2);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    try { ctx.drawImage(img, 0, 0, c.width, c.height); } catch (e) { cb(null); return; }
    var du;
    try { du = c.toDataURL("image/jpeg", 0.92); } catch (e) { cb(null); return; }
    if (!du || du.indexOf("data:image/jpeg") !== 0) { cb(null); return; }
    var bin = atob(du.split(",")[1]);
    var b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    cb(b, c.width, c.height);
  };
  img.onerror = function () { cb(null); };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTxt);
}
window.__downloadPdfSheet = function (P, name, title) {
  if (!P || !P.els) { alert("Лист не построен — нажмите «Отрисовать…»"); return; }
  svgSheetToJpeg(P, null, function (jpg, w, h) {
    if (!jpg) { alert("Не удалось растеризовать лист (браузер заблокировал SVG). Попробуйте другой браузер или Печать страницы (Ctrl+P)."); return; }
    var bytes = pdfFromImageJpeg(jpg, w, h, title || name);
    var blob = new Blob([bytes], { type: "application/pdf" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = (name || "sheet") + ".pdf";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 6000);
  });
};
