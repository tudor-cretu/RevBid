'use strict';

/**
 * Generator PDF minimal, fără dependențe externe.
 * Produce un PDF dintr-o singură pagină A4 cu text, linii și dreptunghiuri,
 * folosind fonturile standard PDF (Helvetica / Helvetica-Bold).
 *
 * Coordonatele expuse sunt top-down (origine sus-stânga); conversia
 * la sistemul PDF (origine jos-stânga) este făcută intern.
 */

const PAGE_W = 595;
const PAGE_H = 842;

/* Romanian → ASCII (fonturile standard PDF nu acoperă ă/ș/ț) */
const DIAC = {
  'ă':'a','â':'a','î':'i','ș':'s','ş':'s','ț':'t','ţ':'t',
  'Ă':'A','Â':'A','Î':'I','Ș':'S','Ş':'S','Ț':'T','Ţ':'T',
};
function latinize(s) {
  return String(s == null ? '' : s)
    .replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, c => DIAC[c] || c)
    .replace(/[^\x20-\x7E]/g, '');
}

function hexToRgb(hex) {
  const h = String(hex || '#000000').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
}

function escapePdf(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/* Lățimea aproximativă a unui caracter Helvetica (în puncte). */
function charW(ch, size) {
  if (ch === ' ') return 0.278 * size;
  if ("iljt.,;:!|'`".includes(ch)) return 0.27 * size;
  if ("frtI()[]/\\".includes(ch)) return 0.34 * size;
  if ("mwMW@".includes(ch))        return 0.87 * size;
  if (ch >= '0' && ch <= '9')      return 0.556 * size;
  if (ch >= 'A' && ch <= 'Z')      return 0.70 * size;
  return 0.52 * size;
}
function textWidth(str, size) {
  let w = 0;
  for (const ch of String(str)) w += charW(ch, size);
  return w;
}

/* Împarte un text în linii care încap în maxWidth. */
function wrapText(str, size, maxWidth) {
  const words = latinize(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function createPdf() {
  const ops = [];
  const f = n => Number(n).toFixed(2);

  /* Dreptunghi plin — y de sus. */
  function rect(x, y, w, h, color) {
    ops.push(`${hexToRgb(color)} rg ${f(x)} ${f(PAGE_H - y - h)} ${f(w)} ${f(h)} re f`);
  }

  /* Linie — coordonate top-down. */
  function line(x1, y1, x2, y2, color, width = 1) {
    ops.push(`${hexToRgb(color)} RG ${f(width)} w ${f(x1)} ${f(PAGE_H - y1)} m ${f(x2)} ${f(PAGE_H - y2)} l S`);
  }

  /* Text — y reprezintă marginea de sus a textului. */
  function text(str, x, y, opts = {}) {
    const { size = 11, bold = false, color = '#1F3442', align = 'left', maxWidth } = opts;
    let s = latinize(str);
    if (maxWidth && textWidth(s, size) > maxWidth) {
      while (s.length > 1 && textWidth(s + '...', size) > maxWidth) s = s.slice(0, -1);
      s = s + '...';
    }
    let tx = x;
    const w = textWidth(s, size);
    if (align === 'right')  tx = x - w;
    if (align === 'center') tx = x - w / 2;
    const font = bold ? '/F2' : '/F1';
    ops.push(`BT ${font} ${f(size)} Tf ${hexToRgb(color)} rg ${f(tx)} ${f(PAGE_H - y - size)} Td (${escapePdf(s)}) Tj ET`);
  }

  function build() {
    const content = ops.join('\n');
    const objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objs[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
              `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`;
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objs[6] = `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    for (let i = 1; i <= 6; i++) {
      offsets[i] = Buffer.byteLength(pdf, 'latin1');
      pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += 'xref\n0 7\n0000000000 65535 f \n';
    for (let i = 1; i <= 6; i++) {
      pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    pdf += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
  }

  return { rect, line, text, build, textWidth, PAGE_W, PAGE_H };
}

module.exports = { createPdf, latinize, wrapText, textWidth, PAGE_W, PAGE_H };
