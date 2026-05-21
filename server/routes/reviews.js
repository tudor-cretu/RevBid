'use strict';

/**
 * RevBid — Workflow post-licitație: confirmări livrare/primire + review-uri.
 * ─────────────────────────────────────────────────────────────────
 * Endpoint-uri (montate la /api):
 *   GET  /auctions/:id/completion        — starea workflow-ului
 *   POST /auctions/:id/confirm-delivery  — furnizorul confirmă livrarea
 *   POST /auctions/:id/confirm-receipt   — buyerul confirmă primirea
 *   POST /auctions/:id/reviews           — creează un review
 *   GET  /users/:id/reviews              — review-urile primite de un user
 *   GET  /users/:id/rating-summary       — rezumatul rating-ului unui user
 */

const router  = require('express').Router();
const mongoose = require('mongoose');

const Auction           = require('../models/Auction');
const Invoice           = require('../models/Invoice');
const User              = require('../models/User');
const Review            = require('../models/Review');
const AuctionCompletion = require('../models/AuctionCompletion');
const authMiddleware    = require('../middleware/auth');
const notifyUser        = require('../utils/notify');
const sendMail          = require('../config/mailer');
const { deliveryConfirmedTemplate, receiptConfirmedTemplate } = require('../config/emailTemplates');
const logger            = require('../utils/logger');
const EVENTS            = require('../utils/events');

const MAX_COMMENT = 1000;

/* ── Helpers ─────────────────────────────────────────────────────── */

/* Încarcă AuctionCompletion-ul; îl creează lazy din Invoice dacă lipsește.
   Returnează null dacă licitația nu are câștigător / nu e finalizată. */
async function getOrCreateCompletion(auctionId) {
  if (!mongoose.isValidObjectId(auctionId)) return null;

  let comp = await AuctionCompletion.findOne({ auction: auctionId });
  if (comp) return comp;

  const invoice = await Invoice.findOne({ auction: auctionId });
  if (!invoice) return null; // fără câștigător sau licitație nefinalizată

  try {
    comp = await AuctionCompletion.create({
      auction:    invoice.auction,
      buyer:      invoice.buyer,
      supplier:   invoice.supplier,
      winningBid: invoice.winningBid,
    });
  } catch (e) {
    if (e.code === 11000) {
      comp = await AuctionCompletion.findOne({ auction: auctionId }); // race — altcineva a creat-o
    } else {
      throw e;
    }
  }
  return comp;
}

/* Rolul unui user față de o colaborare. */
function roleFor(comp, userId) {
  if (comp.buyer.toString()    === userId) return 'buyer';
  if (comp.supplier.toString() === userId) return 'winner';
  return 'other';
}

/* Recalculează rating-ul mediu și numărul de review-uri ale unui user. */
async function recomputeUserRating(userId) {
  const agg = await Review.aggregate([
    { $match: { reviewee: new mongoose.Types.ObjectId(String(userId)), isHidden: { $ne: true } } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg   = agg[0]?.avg   || 0;
  const count = agg[0]?.count || 0;
  await User.findByIdAndUpdate(userId, {
    rating:      Math.round(avg * 10) / 10,
    reviewCount: count,
  });
}

/* Notifică ambele părți că review-urile sunt disponibile. */
async function notifyReadyForReview(io, comp, auction) {
  await notifyUser(io, comp.buyer.toString(), {
    type: 'review_ready',
    text: `Colaborarea pentru "${auction.title}" este completă — poți lăsa acum un review furnizorului.`,
    link: `/auction/${auction._id}`,
  });
  await notifyUser(io, comp.supplier.toString(), {
    type: 'review_ready',
    text: `Colaborarea pentru "${auction.title}" este completă — poți lăsa acum un review cumpărătorului.`,
    link: `/auction/${auction._id}`,
  });
  logger.audit(EVENTS.COMPLETION.READY_FOR_REVIEW,
    `Review-uri deblocate pentru "${auction.title}"`, {
      entityType: 'auction', entityId: auction._id.toString() });
}

/* ── GET /auctions/:id/completion — starea workflow-ului ─────────── */
router.get('/auctions/:id/completion', authMiddleware, async (req, res) => {
  try {
    const comp = await getOrCreateCompletion(req.params.id);
    if (!comp) return res.json({ exists: false });

    const role = roleFor(comp, req.user.id);

    /* Pentru utilizatori neimplicați nu expunem starea detaliată. */
    if (role === 'other') {
      return res.json({ exists: true, role: 'other' });
    }

    const readyForReview = comp.supplierDeliveryConfirmed && comp.buyerReceiptConfirmed;

    const [mine, received] = await Promise.all([
      Review.findOne({ auction: comp.auction, reviewer: req.user.id }),
      Review.findOne({ auction: comp.auction, reviewee: req.user.id }),
    ]);

    res.json({
      exists: true,
      role,
      supplierDeliveryConfirmed:   comp.supplierDeliveryConfirmed,
      supplierDeliveryConfirmedAt: comp.supplierDeliveryConfirmedAt,
      buyerReceiptConfirmed:       comp.buyerReceiptConfirmed,
      buyerReceiptConfirmedAt:     comp.buyerReceiptConfirmedAt,
      readyForReview,
      readyForReviewAt: comp.readyForReviewAt,
      myReview: mine
        ? { rating: mine.rating, comment: mine.comment, createdAt: mine.createdAt }
        : null,
      receivedReview: received && !received.isHidden
        ? { rating: received.rating, comment: received.comment, createdAt: received.createdAt }
        : null,
    });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server' });
  }
});

/* ── POST /auctions/:id/confirm-delivery — furnizorul confirmă ───── */
router.post('/auctions/:id/confirm-delivery', authMiddleware, async (req, res) => {
  try {
    const comp = await getOrCreateCompletion(req.params.id);
    if (!comp) return res.status(404).json({ message: 'Licitația nu are un câștigător sau nu este finalizată.' });

    if (roleFor(comp, req.user.id) !== 'winner') {
      logger.fromReq(req).security(EVENTS.COMPLETION.ACCESS_DENIED,
        'Tentativă neautorizată de confirmare a livrării', {
          entityType: 'auction', entityId: req.params.id });
      return res.status(403).json({ message: 'Doar furnizorul câștigător poate confirma livrarea.' });
    }

    const auction = await Auction.findById(comp.auction);
    if (!auction || auction.status === 'cancelled') {
      return res.status(400).json({ message: 'Licitația nu mai este validă.' });
    }

    if (comp.supplierDeliveryConfirmed) {
      return res.json({ message: 'Livrarea a fost deja confirmată.', alreadyConfirmed: true });
    }

    comp.supplierDeliveryConfirmed   = true;
    comp.supplierDeliveryConfirmedAt = new Date();
    const nowReady = comp.buyerReceiptConfirmed; // cealaltă parte confirmase deja
    if (nowReady && !comp.readyForReviewAt) comp.readyForReviewAt = new Date();
    await comp.save();

    logger.fromReq(req).audit(EVENTS.COMPLETION.DELIVERY_CONFIRMED,
      `Furnizorul a confirmat livrarea pentru "${auction.title}"`, {
        entityType: 'auction', entityId: auction._id.toString() });

    const io = req.app.get('io');
    await notifyUser(io, comp.buyer.toString(), {
      type: 'delivery_confirmed',
      text: `Furnizorul a confirmat livrarea pentru "${auction.title}". Confirmă primirea după ce verifici produsele/serviciile.`,
      link: `/auction/${auction._id}`,
    });

    const buyer = await User.findById(comp.buyer).select('firstName email');
    if (buyer?.email) {
      await sendMail({ to: buyer.email, ...deliveryConfirmedTemplate({
        firstName: buyer.firstName, auctionTitle: auction.title, auctionId: auction._id,
      }) }).catch(() => {});
    }

    if (nowReady) await notifyReadyForReview(io, comp, auction);

    res.json({ message: 'Livrarea a fost confirmată.', readyForReview: nowReady });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server' });
  }
});

/* ── POST /auctions/:id/confirm-receipt — buyerul confirmă ───────── */
router.post('/auctions/:id/confirm-receipt', authMiddleware, async (req, res) => {
  try {
    const comp = await getOrCreateCompletion(req.params.id);
    if (!comp) return res.status(404).json({ message: 'Licitația nu are un câștigător sau nu este finalizată.' });

    if (roleFor(comp, req.user.id) !== 'buyer') {
      logger.fromReq(req).security(EVENTS.COMPLETION.ACCESS_DENIED,
        'Tentativă neautorizată de confirmare a primirii', {
          entityType: 'auction', entityId: req.params.id });
      return res.status(403).json({ message: 'Doar cumpărătorul licitației poate confirma primirea.' });
    }

    const auction = await Auction.findById(comp.auction);
    if (!auction || auction.status === 'cancelled') {
      return res.status(400).json({ message: 'Licitația nu mai este validă.' });
    }

    if (comp.buyerReceiptConfirmed) {
      return res.json({ message: 'Primirea a fost deja confirmată.', alreadyConfirmed: true });
    }

    comp.buyerReceiptConfirmed   = true;
    comp.buyerReceiptConfirmedAt = new Date();
    const nowReady = comp.supplierDeliveryConfirmed;
    if (nowReady && !comp.readyForReviewAt) comp.readyForReviewAt = new Date();
    await comp.save();

    logger.fromReq(req).audit(EVENTS.COMPLETION.RECEIPT_CONFIRMED,
      `Cumpărătorul a confirmat primirea pentru "${auction.title}"`, {
        entityType: 'auction', entityId: auction._id.toString() });

    const io = req.app.get('io');
    await notifyUser(io, comp.supplier.toString(), {
      type: 'receipt_confirmed',
      text: `Cumpărătorul a confirmat primirea pentru "${auction.title}".`,
      link: `/auction/${auction._id}`,
    });

    const supplier = await User.findById(comp.supplier).select('firstName email');
    if (supplier?.email) {
      await sendMail({ to: supplier.email, ...receiptConfirmedTemplate({
        firstName: supplier.firstName, auctionTitle: auction.title, auctionId: auction._id,
      }) }).catch(() => {});
    }

    if (nowReady) await notifyReadyForReview(io, comp, auction);

    res.json({ message: 'Primirea a fost confirmată.', readyForReview: nowReady });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server' });
  }
});

/* ── POST /auctions/:id/reviews — creează un review ──────────────── */
router.post('/auctions/:id/reviews', authMiddleware, async (req, res) => {
  try {
    const comp = await getOrCreateCompletion(req.params.id);
    if (!comp) return res.status(404).json({ message: 'Licitația nu are un câștigător sau nu este finalizată.' });

    const role = roleFor(comp, req.user.id);
    if (role !== 'buyer' && role !== 'winner') {
      logger.fromReq(req).security(EVENTS.REVIEW.ACCESS_DENIED,
        'Tentativă de review din partea unui utilizator neimplicat', {
          entityType: 'auction', entityId: req.params.id });
      return res.status(403).json({ message: 'Doar părțile implicate în licitație pot lăsa un review.' });
    }

    /* Review-urile sunt disponibile doar după confirmarea bilaterală. */
    if (!comp.supplierDeliveryConfirmed || !comp.buyerReceiptConfirmed) {
      return res.status(400).json({
        message: 'Review-urile devin disponibile doar după confirmarea livrării și a primirii de către ambele părți.',
      });
    }

    /* Validare rating */
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      logger.fromReq(req).warn(EVENTS.REVIEW.INVALID, 'Rating invalid la creare review', {
        entityType: 'auction', entityId: req.params.id });
      return res.status(400).json({ message: 'Ratingul trebuie să fie un număr întreg între 1 și 5 stele.' });
    }

    /* Validare comentariu */
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
    if (comment.length > MAX_COMMENT) {
      return res.status(400).json({ message: `Comentariul poate avea cel mult ${MAX_COMMENT} de caractere.` });
    }

    const reviewerRole = role === 'buyer' ? 'buyer'    : 'supplier';
    const revieweeRole = role === 'buyer' ? 'supplier' : 'buyer';
    const revieweeId   = role === 'buyer' ? comp.supplier : comp.buyer;

    /* Anti-duplicat */
    const existing = await Review.findOne({ auction: comp.auction, reviewer: req.user.id });
    if (existing) {
      logger.fromReq(req).warn(EVENTS.REVIEW.DUPLICATE_BLOCKED,
        'Review duplicat blocat', { entityType: 'auction', entityId: req.params.id });
      return res.status(409).json({ message: 'Ai lăsat deja un review pentru această licitație.' });
    }

    let review;
    try {
      review = await Review.create({
        auction:  comp.auction,
        reviewer: req.user.id,
        reviewee: revieweeId,
        reviewerRole, revieweeRole,
        rating, comment,
      });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ message: 'Ai lăsat deja un review pentru această licitație.' });
      }
      throw e;
    }

    /* Actualizează rating summary-ul reviewee-ului */
    await recomputeUserRating(revieweeId);

    /* Marchează colaborarea încheiată dacă ambele părți au lăsat review */
    const reviewCount = await Review.countDocuments({ auction: comp.auction });
    if (reviewCount >= 2 && !comp.completedAt) {
      comp.completedAt = new Date();
      await comp.save();
    }

    logger.fromReq(req).audit(EVENTS.REVIEW.CREATED, 'Review creat', {
      entityType: 'review', entityId: review._id.toString(),
      metadata: { auctionId: comp.auction.toString(), rating, revieweeRole } });

    /* Notifică reviewee-ul */
    const io      = req.app.get('io');
    const auction = await Auction.findById(comp.auction).select('title');
    await notifyUser(io, revieweeId.toString(), {
      type: 'review_received',
      text: `Ai primit un review nou (${rating}★) pentru colaborarea la "${auction?.title || 'o licitație'}".`,
      link: `/auction/${comp.auction}`,
    });

    res.status(201).json({
      message: 'Review-ul a fost trimis cu succes.',
      review: { rating: review.rating, comment: review.comment, createdAt: review.createdAt },
    });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server' });
  }
});

/* ── GET /users/:id/reviews — review-urile primite de un user ────── */
router.get('/users/:id/reviews', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Identificator invalid' });
    }
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filter = { reviewee: req.params.id, isHidden: { $ne: true } };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('reviewer', 'firstName lastName avatar')
        .populate('auction', 'title')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments(filter),
    ]);

    res.json({
      reviews: reviews.map(r => ({
        _id:            r._id,
        rating:         r.rating,
        comment:        r.comment,
        createdAt:      r.createdAt,
        reviewerName:   `${r.reviewer?.firstName || ''} ${r.reviewer?.lastName || ''}`.trim() || 'Utilizator RevBid',
        reviewerAvatar: r.reviewer?.avatar || null,
        reviewerRole:   r.reviewerRole,
        auctionTitle:   r.auction?.title || null,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server' });
  }
});

/* ── GET /users/:id/rating-summary — rezumat rating ──────────────── */
router.get('/users/:id/rating-summary', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Identificator invalid' });
    }
    const agg = await Review.aggregate([
      { $match: { reviewee: new mongoose.Types.ObjectId(req.params.id), isHidden: { $ne: true } } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0, sum = 0;
    for (const d of agg) {
      distribution[d._id] = d.count;
      total += d.count;
      sum   += d._id * d.count;
    }

    res.json({
      average: total ? Math.round((sum / total) * 10) / 10 : 0,
      count:   total,
      distribution,
    });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server' });
  }
});

module.exports = router;
