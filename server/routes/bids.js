'use strict';

const router         = require('express').Router();
const Bid            = require('../models/Bid');
const authMiddleware = require('../middleware/auth');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');

/* ── GET /api/bids/my — ofertele furnizorului logat ─────────── */
/* IMPORTANT: această rută TREBUIE să fie înaintea lui /:auctionId
   altfel Express o interceptează cu auctionId = "my"             */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'supplier') {
      return res.status(403).json({ message: 'Acces interzis — doar furnizorii pot accesa această resursă' });
    }

    const bids = await Bid.find({ supplier: req.user.id })
      .populate({
        path:   'auction',
        select: 'title category status currentPrice startPrice deadline buyer createdAt',
        populate: { path: 'buyer', select: 'firstName lastName companyName' },
      })
      .sort({ createdAt: -1 });

    // Pentru fiecare bid, adaugă numărul total de oferte și rangul
    const enriched = await Promise.all(bids.map(async (bid) => {
      const obj = bid.toObject();
      if (obj.auction?._id) {
        const [totalBids, betterBids] = await Promise.all([
          Bid.countDocuments({ auction: obj.auction._id }),
          Bid.countDocuments({ auction: obj.auction._id, amount: { $lt: obj.amount } }),
        ]);
        obj.totalBids = totalBids;
        obj.rank      = betterBids + 1;  // 1 = oferta câștigătoare (cel mai mic preț)
      }
      return obj;
    }));

    logger.fromReq(req).debug(EVENTS.BID.WINNING,
      `Supplier ${req.user.id} a accesat ofertele proprii (${enriched.length})`, {
        entityType: 'bid',
        metadata:   { count: enriched.length },
      });

    res.json(enriched);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/bids/:auctionId — toate ofertele unei licitații ── */
router.get('/:auctionId', authMiddleware, async (req, res) => {
  try {
    const bids = await Bid.find({ auction: req.params.auctionId })
      .populate('supplier', 'firstName lastName companyName rating')
      .sort({ amount: 1 });

    logger.fromReq(req).debug(EVENTS.BID.WINNING,
      `Fetch oferte pentru licitația ${req.params.auctionId} (${bids.length})`, {
        entityType: 'auction',
        entityId:   req.params.auctionId,
      });

    res.json(bids);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
