'use strict';

/* RevBid — template-uri email, stilizate cu paleta brandului */

const CLIENT = () => process.env.CLIENT_URL || 'http://localhost:5173';

/* ── Layout comun ──────────────────────────────────────────────── */
function layout({ heading, headingColor = '#033667', accent = '#00A99D', intro, bodyHtml = '', ctaText, ctaUrl, ctaColor = '#00A99D' }) {
  return `
  <div style="background:#EAF4F7;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #DDE5EA">
      <div style="height:4px;background:${accent}"></div>
      <div style="padding:28px 28px 24px">
        <div style="font-size:20px;font-weight:800;color:#033667;margin-bottom:18px;letter-spacing:-0.02em">
          Rev<span style="color:#00A99D">Bid</span>
        </div>
        <h1 style="font-size:19px;color:${headingColor};margin:0 0 12px;line-height:1.35">${heading}</h1>
        <p style="font-size:14px;color:#1F3442;line-height:1.6;margin:0 0 16px">${intro}</p>
        ${bodyHtml}
        ${ctaText ? `<a href="${ctaUrl}" style="display:inline-block;background:${ctaColor};color:#ffffff;padding:11px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:4px">${ctaText}</a>` : ''}
        <p style="margin-top:28px;font-size:11px;color:#6B7C86;border-top:1px solid #E8EEF2;padding-top:14px">
          RevBid — Marketplace de licitații inverse.
        </p>
      </div>
    </div>
  </div>`;
}

function priceBox(label, value, color = '#00A99D', bg = '#EAF4F7') {
  return `
    <div style="background:${bg};border-radius:10px;padding:14px;margin:6px 0 18px;text-align:center">
      <p style="margin:0;color:#6B7C86;font-size:12px;text-transform:uppercase;letter-spacing:.04em;font-weight:700">${label}</p>
      <p style="margin:5px 0 0;font-size:26px;font-weight:800;color:${color}">${value}</p>
    </div>`;
}

function metaRow(label, value) {
  return `<tr>
    <td style="padding:5px 0;font-size:13px;color:#6B7C86">${label}</td>
    <td style="padding:5px 0;font-size:13px;color:#1F3442;font-weight:700;text-align:right">${value}</td>
  </tr>`;
}

/* Notă afișată în emailurile care au atașat documentul PDF. */
const INVOICE_NOTE = `
  <div style="background:#D8F3F1;border:1px solid #9FE0DB;border-radius:8px;padding:11px 13px;margin:0 0 16px">
    <p style="margin:0;font-size:12px;color:#007A72;line-height:1.5">
      📎 <strong>Rezumatul tranzacției</strong> (PDF) este atașat acestui email. Îl poți descărca oricând și de pe pagina licitației.
    </p>
  </div>`;

/* ── Supralicitat (bid flow) ───────────────────────────────────── */
const outbidTemplate = ({ firstName, auctionTitle, newPrice, auctionId }) => ({
  subject: `RevBid — Ai fost supralicitat la "${auctionTitle}"`,
  html: layout({
    heading: 'Ai fost supralicitat',
    headingColor: '#B45309', accent: '#F59E0B', ctaColor: '#00A99D',
    intro: `Salut <strong>${firstName}</strong>, cineva a depus o ofertă mai mică la licitația <strong>"${auctionTitle}"</strong>.`,
    bodyHtml: priceBox('Preț curent', `${newPrice} RON`, '#F59E0B', '#FFFBEB'),
    ctaText: 'Licitează din nou', ctaUrl: `${CLIENT()}/auction/${auctionId}`,
  }),
});

/* ── Deadline aproape ──────────────────────────────────────────── */
const deadlineSoonTemplate = ({ firstName, auctionTitle, minutesLeft, auctionId }) => ({
  subject: `RevBid — Licitația "${auctionTitle}" se încheie în ${minutesLeft} minute`,
  html: layout({
    heading: '⏰ Licitația se încheie curând',
    headingColor: '#B45309', accent: '#F59E0B',
    intro: `Salut <strong>${firstName}</strong>, licitația <strong>"${auctionTitle}"</strong> la care participi se încheie în <strong>${minutesLeft} minute</strong>.`,
    ctaText: 'Vezi licitația', ctaUrl: `${CLIENT()}/auction/${auctionId}`,
  }),
});

/* ── Ofertă nouă (către buyer / abonați) ───────────────────────── */
const newBidTemplate = ({ firstName, auctionTitle, amount, auctionId, isOwner = false }) => ({
  subject: isOwner
    ? `RevBid — Ofertă nouă la licitația ta "${auctionTitle}"`
    : `RevBid — Ofertă nouă la "${auctionTitle}"`,
  html: layout({
    heading: isOwner ? 'Ai primit o ofertă nouă' : 'Ofertă nouă la o licitație urmărită',
    intro: isOwner
      ? `Salut <strong>${firstName}</strong>, un furnizor tocmai a depus o ofertă la licitația ta <strong>"${auctionTitle}"</strong>.`
      : `Salut <strong>${firstName}</strong>, a fost depusă o ofertă nouă la <strong>"${auctionTitle}"</strong>.`,
    bodyHtml: priceBox('Preț curent', `${amount} RON`, '#00A99D'),
    ctaText: 'Vezi licitația', ctaUrl: `${CLIENT()}/auction/${auctionId}`,
  }),
});

/* ── Finalizare: câștigător ────────────────────────────────────── */
const auctionWonTemplate = ({ firstName, auctionTitle, finalPrice, buyerName, auctionId, hasInvoice = false }) => ({
  subject: `RevBid — Felicitări! Ai câștigat licitația "${auctionTitle}"`,
  html: layout({
    heading: '🏆 Felicitări, ai câștigat licitația!',
    headingColor: '#17B26A', accent: '#17B26A', ctaColor: '#17B26A',
    intro: `Salut <strong>${firstName}</strong>, oferta ta a fost cea câștigătoare la <strong>"${auctionTitle}"</strong>.`,
    bodyHtml:
      priceBox('Ofertă câștigătoare', `${finalPrice} RON`, '#17B26A', '#DCFCE7') +
      `<table style="width:100%;border-collapse:collapse;margin-bottom:18px">
        ${metaRow('Licitație', auctionTitle)}
        ${buyerName ? metaRow('Inițiator', buyerName) : ''}
      </table>` +
      (hasInvoice ? INVOICE_NOTE : '') +
      `<p style="font-size:13px;color:#6B7C86;line-height:1.6;margin:0 0 16px">
        Pașii următori: deschide pagina licitației pentru a contacta inițiatorul, a confirma detaliile de livrare/execuție și a finaliza colaborarea.
      </p>`,
    ctaText: 'Vezi licitația și pașii următori', ctaUrl: `${CLIENT()}/auction/${auctionId}`,
  }),
});

/* ── Finalizare: buyer ─────────────────────────────────────────── */
const auctionEndedBuyerTemplate = ({ firstName, auctionTitle, finalPrice, winnerName, bidCount, auctionId, hasInvoice = false }) => ({
  subject: `RevBid — Licitația ta "${auctionTitle}" s-a încheiat`,
  html: layout({
    heading: finalPrice != null ? 'Licitația ta s-a încheiat' : 'Licitația ta s-a încheiat fără oferte',
    intro: finalPrice != null
      ? `Salut <strong>${firstName}</strong>, licitația ta <strong>"${auctionTitle}"</strong> s-a încheiat. Oferta câștigătoare este de <strong>${finalPrice} RON</strong> din partea lui <strong>${winnerName || 'un furnizor'}</strong>.`
      : `Salut <strong>${firstName}</strong>, licitația ta <strong>"${auctionTitle}"</strong> s-a încheiat fără oferte primite.`,
    bodyHtml: finalPrice != null
      ? priceBox('Ofertă câștigătoare', `${finalPrice} RON`, '#00A99D') +
        `<table style="width:100%;border-collapse:collapse;margin-bottom:18px">
          ${metaRow('Furnizor câștigător', winnerName || '—')}
          ${metaRow('Total oferte primite', bidCount)}
        </table>` +
        (hasInvoice ? INVOICE_NOTE : '') +
        `<p style="font-size:13px;color:#6B7C86;line-height:1.6;margin:0 0 16px">
          Pașii următori: contactează furnizorul câștigător pentru a confirma detaliile și a stabili livrarea sau execuția.
        </p>`
      : `<p style="font-size:13px;color:#6B7C86;line-height:1.6;margin:0 0 16px">
          Poți publica o licitație nouă cu un deadline mai lung sau un preț de pornire mai atractiv.
        </p>`,
    ctaText: finalPrice != null ? 'Vezi rezultatul și pașii următori' : 'Vezi licitația',
    ctaUrl: `${CLIENT()}/auction/${auctionId}`,
  }),
});

/* ── Finalizare: furnizor necâștigător ─────────────────────────── */
const auctionLostTemplate = ({ firstName, auctionTitle, myAmount, finalPrice, auctionId }) => ({
  subject: `RevBid — Licitația "${auctionTitle}" s-a încheiat`,
  html: layout({
    heading: 'Licitația s-a încheiat',
    intro: `Salut <strong>${firstName}</strong>, licitația <strong>"${auctionTitle}"</strong> s-a încheiat. Oferta ta nu a fost selectată de această dată.`,
    bodyHtml:
      `<table style="width:100%;border-collapse:collapse;margin-bottom:18px">
        ${metaRow('Oferta ta', `${myAmount} RON`)}
        ${finalPrice != null ? metaRow('Ofertă câștigătoare', `${finalPrice} RON`) : ''}
        ${metaRow('Status final', 'Încheiată')}
      </table>
      <p style="font-size:13px;color:#6B7C86;line-height:1.6;margin:0 0 16px">
        Nu te descuraja — sunt licitații noi în fiecare zi. Explorează oportunitățile deschise.
      </p>`,
    ctaText: 'Vezi alte licitații', ctaUrl: `${CLIENT()}/dashboard`,
  }),
});

/* ── Finalizare: abonat fără ofertă ────────────────────────────── */
const auctionEndedSubscriberTemplate = ({ firstName, auctionTitle, auctionId }) => ({
  subject: `RevBid — Licitația urmărită "${auctionTitle}" s-a încheiat`,
  html: layout({
    heading: 'O licitație urmărită s-a încheiat',
    intro: `Salut <strong>${firstName}</strong>, licitația <strong>"${auctionTitle}"</strong> pe care o urmăreai s-a încheiat.`,
    bodyHtml: `<p style="font-size:13px;color:#6B7C86;line-height:1.6;margin:0 0 16px">
      Descoperă licitații similare deschise acum și depune o ofertă competitivă.
    </p>`,
    ctaText: 'Explorează licitații', ctaUrl: `${CLIENT()}/dashboard`,
  }),
});

/* ── Resetare parolă ───────────────────────────────────────────── */
const resetPasswordTemplate = ({ firstName, resetUrl }) => ({
  subject: 'RevBid — Resetează-ți parola',
  html: layout({
    heading: 'Resetare parolă',
    intro: `Salut <strong>${firstName || ''}</strong>, ai solicitat resetarea parolei pentru contul tău RevBid. Apasă butonul de mai jos pentru a seta o parolă nouă.`,
    bodyHtml:
      `<p style="font-size:13px;color:#6B7C86;line-height:1.6;margin:14px 0 6px">
        Dacă butonul nu funcționează, copiază acest link în browser:
      </p>
      <p style="font-size:12px;margin:0 0 16px;word-break:break-all">
        <a href="${resetUrl}" style="color:#0871C4">${resetUrl}</a>
      </p>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:11px 13px;margin:0 0 12px">
        <p style="margin:0;font-size:12px;color:#92400E">⏳ Link-ul expiră în <strong>60 de minute</strong> și poate fi folosit o singură dată.</p>
      </div>
      <p style="font-size:12px;color:#6B7C86;line-height:1.6;margin:0 0 16px">
        🔒 Dacă nu ai solicitat această resetare, poți ignora în siguranță acest email — parola ta rămâne neschimbată.
      </p>`,
    ctaText: 'Resetează parola', ctaUrl: resetUrl, ctaColor: '#00A99D',
  }),
});

module.exports = {
  outbidTemplate,
  deadlineSoonTemplate,
  newBidTemplate,
  auctionWonTemplate,
  auctionEndedBuyerTemplate,
  auctionLostTemplate,
  auctionEndedSubscriberTemplate,
  resetPasswordTemplate,
};
