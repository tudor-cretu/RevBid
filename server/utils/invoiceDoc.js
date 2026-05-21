'use strict';

/* Generează documentul PDF „Rezumat de Tranzacție" dintr-un Invoice. */

const PDFDocument = require('pdfkit');
const fs          = require('fs');

const PAGE_W = 595.28;
const M      = 48;        // margine stânga/dreapta
const RIGHT  = PAGE_W - M;

const C = {
  navy:   '#033667',
  teal:   '#00A99D',
  aqua:   '#D8F3F1',
  slate:  '#1F3442',
  muted:  '#6B7C86',
  border: '#DDE5EA',
  white:  '#FFFFFF',
};

function findFont(candidates) {
  for (const p of candidates) {
    try { fs.accessSync(p, fs.constants.R_OK); return p; } catch (_) {}
  }
  return null;
}

const FONT_PATH = findFont([
  'C:\\Windows\\Fonts\\calibri.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]);
const FONT_BOLD_PATH = findFont([
  'C:\\Windows\\Fonts\\calibrib.ttf',
  'C:\\Windows\\Fonts\\arialbd.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
]);

const fmtMoney = (n, cur) =>
  `${Number(n || 0).toLocaleString('ro-RO')} ${cur || 'RON'}`;
const fmtDate = d =>
  d ? new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
/* Format standardizat dd/mm/yyyy HH:mm (24h, zero-padding). */
const fmtDT = d => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const p = n => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

/**
 * @param {object} inv  Invoice (doc Mongoose sau obiect simplu)
 * @returns {Promise<Buffer>} PDF
 */
function buildInvoicePdf(inv) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 0, compress: false });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const REG  = FONT_PATH      ? 'Regular'  : 'Helvetica';
    const BOLD = FONT_BOLD_PATH ? 'Bold'     : 'Helvetica-Bold';
    if (FONT_PATH)      doc.registerFont('Regular', FONT_PATH);
    if (FONT_BOLD_PATH) doc.registerFont('Bold',    FONT_BOLD_PATH);

    /* ── Header band ── */
    doc.rect(0, 0, PAGE_W, 92).fill(C.navy);

    doc.font(BOLD).fontSize(26);
    const revW = doc.widthOfString('Rev');
    doc.fillColor(C.white).text('Rev', M, 30, { lineBreak: false });
    doc.fillColor(C.teal) .text('Bid', M + revW, 30, { lineBreak: false });

    doc.font(BOLD).fontSize(10).fillColor('#9FC6E0')
       .text('REZUMAT DE TRANZACȚIE', M, 30, { align: 'right', width: RIGHT - M, lineBreak: false });
    doc.font(REG).fontSize(9).fillColor('#7FA8C6')
       .text('Platformă de licitații inverse', M, 46, { align: 'right', width: RIGHT - M, lineBreak: false });

    /* ── Titlu document + identificare ── */
    let y = 128;
    doc.font(BOLD).fontSize(22).fillColor(C.navy)
       .text('Rezumat de Tranzacție', M, y, { lineBreak: false });
    doc.font(REG).fontSize(9.5).fillColor(C.muted)
       .text(
         'Document informativ generat automat · nu constituie factură fiscală în sensul legislației în vigoare.',
         M, y + 31, { lineBreak: false }
       );

    doc.font(BOLD).fontSize(8).fillColor(C.muted)
       .text('NR. DOCUMENT', M, y, { align: 'right', width: RIGHT - M, lineBreak: false });
    doc.font(BOLD).fontSize(13).fillColor(C.navy)
       .text(inv.invoiceNumber || '—', M, y + 12, { align: 'right', width: RIGHT - M, lineBreak: false });
    doc.font(BOLD).fontSize(8).fillColor(C.muted)
       .text('DATA EMITERII', M, y + 35, { align: 'right', width: RIGHT - M, lineBreak: false });
    doc.font(REG).fontSize(11).fillColor(C.slate)
       .text(fmtDate(inv.generatedAt || new Date()), M, y + 47, { align: 'right', width: RIGHT - M, lineBreak: false });

    y = 196;
    doc.lineWidth(1).moveTo(M, y).lineTo(RIGHT, y).stroke(C.border);

    /* ── Părți implicate ── */
    y += 22;
    doc.font(BOLD).fontSize(9).fillColor(C.teal)
       .text('PĂRȚI IMPLICATE', M, y, { lineBreak: false });

    y += 20;
    const colR  = PAGE_W / 2 + 8;
    const colW1 = PAGE_W / 2 - M - 16;
    const colW2 = RIGHT - colR;

    doc.font(BOLD).fontSize(8).fillColor(C.muted)
       .text('CUMPĂRĂTOR',         M,    y, { lineBreak: false })
       .text('OFERTANT CÂȘTIGĂTOR', colR, y, { lineBreak: false });

    y += 14;
    doc.font(BOLD).fontSize(13).fillColor(C.navy)
       .text(inv.buyerName    || '—', M,    y, { width: colW1, lineBreak: false })
       .text(inv.supplierName || '—', colR, y, { width: colW2, lineBreak: false });

    /* Date companie / date fiscale sub fiecare parte */
    const partyY = y + 20;
    const drawCompany = (company, x, colW) => {
      let cy = partyY;
      if (company && company.legalName) {
        doc.font(BOLD).fontSize(8.5).fillColor(C.slate)
           .text(company.legalName, x, cy, { width: colW, height: 11, ellipsis: true, lineBreak: false });
        cy += 12;
        if (company.taxId) {
          doc.font(REG).fontSize(8).fillColor(C.muted)
             .text(`C.U.I./C.I.F.: ${company.taxId}`, x, cy, { width: colW, lineBreak: false });
          cy += 11;
        }
        if (company.tradeRegisterNumber) {
          doc.font(REG).fontSize(8).fillColor(C.muted)
             .text(`Reg. Com.: ${company.tradeRegisterNumber}`, x, cy, { width: colW, lineBreak: false });
          cy += 11;
        }
        if (company.addressText) {
          doc.font(REG).fontSize(8).fillColor(C.muted)
             .text(company.addressText, x, cy, { width: colW, height: 22, ellipsis: true });
        }
      } else {
        doc.font(REG).fontSize(8).fillColor(C.muted)
           .text('Date fiscale necompletate.', x, cy, { width: colW, lineBreak: false });
      }
    };
    drawCompany(inv.buyerCompany,    M,    colW1);
    drawCompany(inv.supplierCompany, colR, colW2);

    /* ── Detalii licitație ── */
    y = partyY + 62;
    doc.font(BOLD).fontSize(9).fillColor(C.teal)
       .text('DETALII LICITAȚIE', M, y, { lineBreak: false });

    const rows = [
      ['Titlul licitației', inv.auctionTitle || '—'],
      ['Identificator',     String(inv.auction || '—')],
      ['Categorie',         inv.category || '—'],
      ['Cantitate',         inv.quantity || '—'],
      ['Termen-limită',     fmtDT(inv.deadline)],
      ['Data finalizării',  fmtDT(inv.finalizedAt)],
      ['Stare',             'Finalizată · câștigător desemnat'],
    ];

    const valX = M + 155;
    const valW = RIGHT - valX;

    for (const [label, value] of rows) {
      y += 22;
      doc.font(REG).fontSize(10).fillColor(C.muted)
         .text(label, M, y, { lineBreak: false });
      doc.font(BOLD).fontSize(10.5).fillColor(C.slate)
         .text(String(value), valX, y, { width: valW, lineBreak: false });
    }

    if (inv.description) {
      y += 22;
      doc.font(REG).fontSize(10).fillColor(C.muted)
         .text('Descriere', M, y, { lineBreak: false });
      const descHeight = 42; // max 3 rânduri
      doc.font(REG).fontSize(10.5).fillColor(C.slate)
         .text(String(inv.description), valX, y, { width: valW, height: descHeight, ellipsis: true, lineBreak: true });
      y += descHeight - 10.5;
    }

    /* ── Valoarea ofertei câștigătoare ── */
    y += 38;
    doc.rect(M, y, RIGHT - M, 78).fill(C.aqua);

    doc.font(BOLD).fontSize(9).fillColor('#007A72')
       .text('VALOAREA OFERTEI CÂȘTIGĂTOARE', M + 22, y + 19, { lineBreak: false });
    doc.font(BOLD).fontSize(25).fillColor(C.teal)
       .text(fmtMoney(inv.amount, inv.currency), M + 22, y + 34, { lineBreak: false });

    doc.font(REG).fontSize(9).fillColor(C.muted)
       .text('TVA: neaplicabil', M, y + 30, { align: 'right', width: RIGHT - M, lineBreak: false })
       .text('Ofertă câștigătoare · licitație inversă', M, y + 45, { align: 'right', width: RIGHT - M, lineBreak: false });

    /* ── Footer / disclaimer ── */
    let fy = 712;
    doc.lineWidth(1).moveTo(M, fy).lineTo(RIGHT, fy).stroke(C.border);
    fy += 15;

    const disclaimer =
      'Prezentul document constituie un rezumat informativ al tranzacției rezultate în urma finalizării ' +
      'unei licitații inverse pe platforma RevBid. Nu are valoare fiscală și nu substituie factura ' +
      'fiscală emisă în conformitate cu legislația în vigoare. Facturarea va fi efectuată direct între ' +
      'cumpărător și ofertantul câștigător, conform obligațiilor legale aplicabile.';

    doc.font(REG).fontSize(8.5).fillColor(C.muted)
       .text(disclaimer, M, fy, { width: RIGHT - M, lineBreak: true, height: 50 });

    fy += 55;
    doc.font(BOLD).fontSize(8.5).fillColor(C.navy)
       .text(
         'Document generat automat de RevBid · ' + fmtDT(inv.generatedAt || new Date()),
         M, fy, { lineBreak: false }
       );

    doc.end();
  });
}

module.exports = { buildInvoicePdf };
