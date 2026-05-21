'use strict';

/**
 * RevBid — flow de notificare pentru finalizarea licitațiilor.
 *
 * Notifică, fără duplicate și cu prioritizare:
 *   1. furnizorul câștigător
 *   2. inițiatorul (buyer)
 *   3. furnizorii care au licitat, dar nu au câștigat
 *   4. abonații care nu au licitat
 *
 * Pe fiecare canal (in-app + email) un utilizator primește o singură
 * notificare per eveniment. Emite și un event socket `auction_finalized`
 * pentru pop-up live la utilizatorii aflați pe pagina licitației.
 */

const Auction      = require('../models/Auction');
const Bid          = require('../models/Bid');
const Subscription = require('../models/Subscription');
const Invoice      = require('../models/Invoice');
const Counter      = require('../models/Counter');
const sendMail     = require('../config/mailer');
const notifyUser   = require('../utils/notify');
const { buildInvoicePdf } = require('../utils/invoiceDoc');
const { companySnapshot } = require('../utils/company');
const logger       = require('../utils/logger');
const EVENTS       = require('../utils/events');
const {
  auctionWonTemplate,
  auctionEndedBuyerTemplate,
  auctionLostTemplate,
  auctionEndedSubscriberTemplate,
} = require('../config/emailTemplates');

/* Trimite un email și loghează rezultatul (fără date sensibile). */
async function deliverEmail(auctionId, email, template, role, attachments) {
  if (!email) return false;
  const ok = await sendMail({ to: email, subject: template.subject, html: template.html, attachments });
  if (ok) {
    logger.info(EVENTS.NOTIFY.EMAIL_SENT, `Email finalizare trimis (${role})`, {
      entityType: 'auction', entityId: auctionId, metadata: { role, withInvoice: !!attachments } });
  } else {
    logger.warn(EVENTS.NOTIFY.EMAIL_FAILED, `Email finalizare eșuat (${role})`, {
      entityType: 'auction', entityId: auctionId, metadata: { role } });
  }
  return ok;
}

const fullName = u => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

/* Creează (sau returnează, dacă există deja) invoice-ul unei licitații. */
async function getOrCreateInvoice(auction, winningBid) {
  const existing = await Invoice.findOne({ auction: auction._id });
  if (existing) return existing;

  const year = new Date().getFullYear();
  const seq  = await Counter.next(`invoice-${year}`);
  const invoiceNumber = `RB-TS-${year}-${String(seq).padStart(6, '0')}`;

  const supplier   = winningBid.supplier;
  const buyer      = auction.buyer;
  const buyerLabel = fullName(buyer)    + (buyer?.companyName    ? ` (${buyer.companyName})`    : '');
  const suppLabel  = fullName(supplier) + (supplier?.companyName ? ` (${supplier.companyName})` : '');

  const invoice = await Invoice.create({
    invoiceNumber,
    auction:      auction._id,
    buyer:        buyer?._id || auction.buyer,
    supplier:     supplier._id,
    winningBid:   winningBid._id,
    amount:       winningBid.amount,
    currency:     'RON',
    auctionTitle: auction.title,
    category:     auction.category,
    description:  auction.description,
    buyerName:    buyerLabel || '—',
    supplierName: suppLabel  || '—',
    deadline:     auction.deadline,
    finalizedAt:  auction.endedNotifiedAt || new Date(),
    status:       'generated',

    // Snapshot date companie — stabile chiar dacă profilul se schimbă ulterior
    buyerCompany:    companySnapshot(buyer?.company),
    supplierCompany: companySnapshot(supplier?.company),
  });

  logger.audit(EVENTS.INVOICE.GENERATED,
    `Rezumat tranzacție generat: ${invoiceNumber}`, {
      entityType: 'invoice', entityId: invoice._id.toString(),
      metadata: { auctionId: auction._id.toString(), amount: invoice.amount } });

  return invoice;
}

/**
 * Declanșează tot flow-ul de notificare pentru o licitație finalizată.
 * Idempotent: folosește flag-ul atomic `endNotificationsSent`.
 *
 * @param {import('socket.io').Server} io
 * @param {string|object} auctionId
 */
async function finalizeAuctionNotifications(io, auctionId) {
  const idStr = auctionId.toString();
  try {
    /* ── Guard atomic — revendică finalizarea o singură dată ──────── */
    const auction = await Auction.findOneAndUpdate(
      { _id: auctionId, endNotificationsSent: { $ne: true } },
      { $set: { endNotificationsSent: true, endedNotifiedAt: new Date() } },
      { new: true }
    ).populate('buyer', 'firstName lastName email companyName company');

    if (!auction) {
      logger.debug(EVENTS.NOTIFY.AUCTION_END_SKIP,
        `Notificările de finalizare au fost deja trimise: ${idStr}`,
        { entityType: 'auction', entityId: idStr });
      return;
    }

    /* ── Determinare câștigător ───────────────────────────────────
       Reverse bidding: câștigă oferta validă cu suma cea mai mică.
       Folosim flag-ul `isWinning` menținut la fiecare bid; fallback
       pe minimul efectiv dacă flag-ul lipsește.                   */
    const allBids = await Bid.find({ auction: auctionId })
      .populate('supplier', 'firstName lastName email companyName company')
      .sort({ amount: 1 });

    let winningBid = allBids.find(b => b.isWinning) || null;
    if (!winningBid && allBids.length > 0) winningBid = allBids[0];

    const bidCount   = allBids.length;
    const winnerId   = winningBid?.supplier?._id?.toString() || null;
    const winnerName = winningBid?.supplier
      ? `${winningBid.supplier.firstName || ''} ${winningBid.supplier.lastName || ''}`.trim()
      : null;
    const finalPrice = winningBid?.amount ?? null;
    const buyerId    = auction.buyer?._id?.toString() || null;
    const link       = `/auction/${idStr}`;

    logger.audit(EVENTS.AUCTION.WINNER_DETERMINED,
      winnerId
        ? `Câștigător determinat pentru "${auction.title}": ${finalPrice} RON`
        : `Licitația "${auction.title}" s-a încheiat fără oferte`,
      { entityType: 'auction', entityId: idStr, metadata: { winnerId, finalPrice, bidCount } });

    /* ── Invoice / Rezumat tranzacție — doar dacă există câștigător ──
       Nu se generează pentru licitații fără oferte sau anulate.      */
    let invoice       = null;
    let pdfAttachment = null;
    if (winningBid?.supplier && winnerId && auction.status === 'closed') {
      try {
        invoice = await getOrCreateInvoice(auction, winningBid);
        const pdf = await buildInvoicePdf(invoice);
        pdfAttachment = [{
          filename:    `RevBid-${invoice.invoiceNumber}.pdf`,
          content:     pdf,
          contentType: 'application/pdf',
        }];
      } catch (e) {
        logger.error(EVENTS.INVOICE.GENERATE_FAILED,
          `Generare invoice eșuată pentru "${auction.title}": ${e.message}`,
          { entityType: 'auction', entityId: idStr, errorMessage: e.message, stack: e.stack });
        invoice = null; pdfAttachment = null;
      }
    }
    const hasInvoice = !!invoice;

    /* ── Pop-up live — emis imediat, înainte de email-uri (instant pe pagină) ── */
    const payload = {
      auctionId: idStr,
      status:    auction.status,
      finalPrice, winnerId, winnerName, bidCount, buyerId, hasInvoice,
    };
    io.to(idStr).emit('auction_finalized', payload);
    /* Backward-compat — handler-ul existent care marca licitația închisă */
    io.to(idStr).emit('auction_closed', { auctionId: idStr, finalPrice, winnerId });
    logger.info(EVENTS.NOTIFY.POPUP_EMITTED,
      `Pop-up de finalizare emis pentru "${auction.title}"`,
      { entityType: 'auction', entityId: idStr });

    /* ── Cea mai bună ofertă per furnizor (pentru necâștigători) ──── */
    const bestBySupplier = new Map();
    for (const b of allBids) {
      if (!b.supplier) continue;
      const sid = b.supplier._id.toString();
      const cur = bestBySupplier.get(sid);
      if (!cur || b.amount < cur.amount) bestBySupplier.set(sid, { user: b.supplier, amount: b.amount });
    }

    /* ── Dedup cu prioritate: câștigător > buyer > licitant > abonat ── */
    const handled = new Set();
    let inApp = 0;

    /* 1. Câștigător */
    if (winningBid?.supplier && winnerId) {
      handled.add(winnerId);
      await notifyUser(io, winnerId, {
        type: 'auction_won',
        text: `Felicitări! Ai câștigat licitația "${auction.title}" — ${finalPrice} RON`,
        link,
      });
      inApp++;
      const ok = await deliverEmail(idStr, winningBid.supplier.email, auctionWonTemplate({
        firstName:    winningBid.supplier.firstName,
        auctionTitle: auction.title,
        finalPrice,
        buyerName:    fullName(auction.buyer),
        auctionId:    idStr,
        hasInvoice,
      }), 'winner', pdfAttachment);
      if (invoice && ok) invoice.emailedAtSupplier = new Date();
    }

    /* 2. Buyer */
    if (auction.buyer && buyerId && !handled.has(buyerId)) {
      handled.add(buyerId);
      await notifyUser(io, buyerId, {
        type: 'auction_ended',
        text: winnerId
          ? `Licitația ta "${auction.title}" s-a încheiat — ofertă câștigătoare ${finalPrice} RON de la ${winnerName}`
          : `Licitația ta "${auction.title}" s-a încheiat fără oferte primite`,
        link,
      });
      inApp++;
      const ok = await deliverEmail(idStr, auction.buyer.email, auctionEndedBuyerTemplate({
        firstName:    auction.buyer.firstName,
        auctionTitle: auction.title,
        finalPrice, winnerName, bidCount,
        auctionId:    idStr,
        hasInvoice,
      }), 'buyer', pdfAttachment);
      if (invoice && ok) invoice.emailedAtBuyer = new Date();
    }

    /* Persistăm marcajele de email pe invoice */
    if (invoice) {
      invoice.status = (invoice.emailedAtBuyer && invoice.emailedAtSupplier) ? 'sent' : 'generated';
      try { await invoice.save(); } catch (e) {
        logger.warn(EVENTS.INVOICE.GENERATE_FAILED, `Salvare status invoice eșuată: ${e.message}`,
          { entityType: 'invoice', entityId: invoice._id.toString() });
      }
      logger.audit(EVENTS.INVOICE.EMAILED,
        `Invoice ${invoice.invoiceNumber} — distribuit prin email`, {
          entityType: 'invoice', entityId: invoice._id.toString(),
          metadata: { emailedBuyer: !!invoice.emailedAtBuyer, emailedSupplier: !!invoice.emailedAtSupplier } });
    }

    /* 3. Furnizori care au licitat, dar nu au câștigat */
    for (const [sid, { user, amount }] of bestBySupplier) {
      if (handled.has(sid)) continue;
      handled.add(sid);
      await notifyUser(io, sid, {
        type: 'auction_lost',
        text: `Licitația "${auction.title}" s-a încheiat — oferta ta nu a fost selectată`,
        link,
      });
      inApp++;
      await deliverEmail(idStr, user.email, auctionLostTemplate({
        firstName:    user.firstName,
        auctionTitle: auction.title,
        myAmount:     amount,
        finalPrice,
        auctionId:    idStr,
      }), 'loser');
    }

    /* 4. Abonați care nu au licitat */
    const subs = await Subscription.find({ auction: auctionId })
      .populate('user', 'firstName lastName email');
    for (const sub of subs) {
      if (!sub.user) continue;
      const sid = sub.user._id.toString();
      if (handled.has(sid)) continue;
      handled.add(sid);
      await notifyUser(io, sid, {
        type: 'auction_watch_ended',
        text: `Licitația urmărită "${auction.title}" s-a încheiat`,
        link,
      });
      inApp++;
      await deliverEmail(idStr, sub.user.email, auctionEndedSubscriberTemplate({
        firstName:    sub.user.firstName,
        auctionTitle: auction.title,
        auctionId:    idStr,
      }), 'subscriber');
    }

    logger.audit(EVENTS.NOTIFY.AUCTION_END_FLOW,
      `Flow notificări finalizare complet pentru "${auction.title}"`,
      { entityType: 'auction', entityId: idStr,
        metadata: { usersNotified: handled.size, inAppNotifications: inApp, bidCount, winnerId } });

  } catch (err) {
    logger.error(EVENTS.SYSTEM.UNHANDLED_ERROR,
      `Eroare în flow notificări finalizare licitație ${idStr}: ${err.message}`,
      { entityType: 'auction', entityId: idStr,
        errorName: err.name, errorMessage: err.message, stack: err.stack });
  }
}

module.exports = { finalizeAuctionNotifications };
