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
const sendMail     = require('../config/mailer');
const notifyUser   = require('../utils/notify');
const logger       = require('../utils/logger');
const EVENTS       = require('../utils/events');
const {
  auctionWonTemplate,
  auctionEndedBuyerTemplate,
  auctionLostTemplate,
  auctionEndedSubscriberTemplate,
} = require('../config/emailTemplates');

/* Trimite un email și loghează rezultatul (fără date sensibile). */
async function deliverEmail(auctionId, email, template, role) {
  if (!email) return;
  const ok = await sendMail({ to: email, subject: template.subject, html: template.html });
  if (ok) {
    logger.info(EVENTS.NOTIFY.EMAIL_SENT, `Email finalizare trimis (${role})`, {
      entityType: 'auction', entityId: auctionId, metadata: { role },
    });
  } else {
    logger.warn(EVENTS.NOTIFY.EMAIL_FAILED, `Email finalizare eșuat (${role})`, {
      entityType: 'auction', entityId: auctionId, metadata: { role },
    });
  }
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
    ).populate('buyer', 'firstName lastName email companyName');

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
      .populate('supplier', 'firstName lastName email')
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

    /* ── Pop-up live — emis imediat, înainte de email-uri (instant pe pagină) ── */
    const payload = {
      auctionId: idStr,
      status:    auction.status,
      finalPrice, winnerId, winnerName, bidCount, buyerId,
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
      await deliverEmail(idStr, winningBid.supplier.email, auctionWonTemplate({
        firstName:    winningBid.supplier.firstName,
        auctionTitle: auction.title,
        finalPrice,
        buyerName:    `${auction.buyer?.firstName || ''} ${auction.buyer?.lastName || ''}`.trim(),
        auctionId:    idStr,
      }), 'winner');
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
      await deliverEmail(idStr, auction.buyer.email, auctionEndedBuyerTemplate({
        firstName:    auction.buyer.firstName,
        auctionTitle: auction.title,
        finalPrice, winnerName, bidCount,
        auctionId:    idStr,
      }), 'buyer');
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
