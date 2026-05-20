'use strict';

/* Compune documentul PDF "Rezumat tranzacție" din datele unui Invoice. */

const { createPdf, wrapText } = require('./pdf');

const C = {
  navy:  '#033667', teal:  '#00A99D', aqua: '#D8F3F1',
  slate: '#1F3442', muted: '#6B7C86', border: '#DDE5EA', white: '#FFFFFF',
};
const M = 48; // margine

const fmtMoney = (n, cur) => `${Number(n || 0).toLocaleString('ro-RO')} ${cur || 'RON'}`;
const fmtDate  = d => (d ? new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
const fmtDT    = d => (d ? new Date(d).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * @param {object} inv  Invoice (doc Mongoose sau obiect simplu)
 * @returns {Buffer} PDF
 */
function buildInvoicePdf(inv) {
  const doc    = createPdf();
  const W      = doc.PAGE_W;
  const rightX = W - M;

  /* ── Header band ── */
  doc.rect(0, 0, W, 92, C.navy);
  doc.text('Rev', M, 32, { size: 26, bold: true, color: C.white });
  const revW = doc.textWidth('Rev', 26);
  doc.text('Bid', M + revW, 32, { size: 26, bold: true, color: C.teal });
  doc.text('REZUMAT TRANZACȚIE', rightX, 30, { size: 10, bold: true, color: '#9FC6E0', align: 'right' });
  doc.text('Marketplace de licitații inverse', rightX, 46, { size: 9, color: '#7FA8C6', align: 'right' });

  /* ── Titlu document + identificare ── */
  let y = 128;
  doc.text('Rezumat tranzacție', M, y, { size: 22, bold: true, color: C.navy });
  doc.text('Document informativ generat automat — nu reprezintă o factură fiscală.',
    M, y + 31, { size: 9.5, color: C.muted });

  doc.text('NR. DOCUMENT', rightX, y, { size: 8, bold: true, color: C.muted, align: 'right' });
  doc.text(inv.invoiceNumber || '—', rightX, y + 12, { size: 13, bold: true, color: C.navy, align: 'right' });
  doc.text('DATA GENERĂRII', rightX, y + 35, { size: 8, bold: true, color: C.muted, align: 'right' });
  doc.text(fmtDate(inv.generatedAt || new Date()), rightX, y + 47, { size: 11, color: C.slate, align: 'right' });

  y = 196;
  doc.line(M, y, rightX, y, C.border, 1);

  /* ── Părți implicate ── */
  y += 22;
  doc.text('PĂRȚI IMPLICATE', M, y, { size: 9, bold: true, color: C.teal });
  y += 20;
  const colR = W / 2 + 8;
  doc.text('CUMPĂRĂTOR', M, y, { size: 8, bold: true, color: C.muted });
  doc.text('FURNIZOR CÂȘTIGĂTOR', colR, y, { size: 8, bold: true, color: C.muted });
  doc.text(inv.buyerName || '—',    M,    y + 14, { size: 13, bold: true, color: C.navy, maxWidth: W / 2 - M - 16 });
  doc.text(inv.supplierName || '—', colR, y + 14, { size: 13, bold: true, color: C.navy, maxWidth: rightX - colR });

  /* ── Detalii licitație ── */
  y += 52;
  doc.text('DETALII LICITAȚIE', M, y, { size: 9, bold: true, color: C.teal });

  const rows = [
    ['Titlul licitației',  inv.auctionTitle || '—'],
    ['ID licitație',       String(inv.auction || '—')],
    ['Categorie',          inv.category || '—'],
    ['Deadline licitație', fmtDT(inv.deadline)],
    ['Data finalizării',   fmtDT(inv.finalizedAt)],
    ['Status',             'Finalizată — câștigător desemnat'],
  ];
  const valX = M + 155;
  for (const [label, value] of rows) {
    y += 22;
    doc.text(label, M, y, { size: 10, color: C.muted });
    doc.text(String(value), valX, y, { size: 10.5, bold: true, color: C.slate, maxWidth: rightX - valX });
  }

  if (inv.description) {
    y += 22;
    doc.text('Descriere', M, y, { size: 10, color: C.muted });
    const lines = wrapText(inv.description, 10.5, rightX - valX).slice(0, 3);
    lines.forEach((ln, i) => doc.text(ln, valX, y + i * 14, { size: 10.5, color: C.slate }));
    y += (lines.length - 1) * 14;
  }

  /* ── Sumă totală ── */
  y += 38;
  doc.rect(M, y, rightX - M, 78, C.aqua);
  doc.text('SUMĂ TOTALĂ TRANZACȚIE', M + 22, y + 19, { size: 9, bold: true, color: '#007A72' });
  doc.text(fmtMoney(inv.amount, inv.currency), M + 22, y + 34, { size: 25, bold: true, color: C.teal });
  doc.text('TVA: nu se aplică', rightX - 22, y + 30, { size: 9, color: C.muted, align: 'right' });
  doc.text('Ofertă câștigătoare — licitație inversă', rightX - 22, y + 45, { size: 9, color: C.muted, align: 'right' });

  /* ── Footer / disclaimer ── */
  let fy = 712;
  doc.line(M, fy, rightX, fy, C.border, 1);
  fy += 15;
  const disclaimer =
    'Acest document este un rezumat informativ al tranzacției rezultate dintr-o licitație pe platforma ' +
    'RevBid. Nu reprezintă o factură fiscală și nu înlocuiește documentele contabile oficiale. Pentru ' +
    'facturarea fiscală, părțile sunt responsabile conform legislației aplicabile.';
  wrapText(disclaimer, 8.5, rightX - M).slice(0, 4)
    .forEach((ln, i) => doc.text(ln, M, fy + i * 11, { size: 8.5, color: C.muted }));
  fy += 4 * 11 + 8;
  doc.text('Document generat automat de RevBid · ' + fmtDT(inv.generatedAt || new Date()),
    M, fy, { size: 8.5, bold: true, color: C.navy });

  return doc.build();
}

module.exports = { buildInvoicePdf };
