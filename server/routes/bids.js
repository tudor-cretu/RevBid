'use strict';

const router         = require('express').Router();
const Bid            = require('../models/Bid');
const Auction        = require('../models/Auction');
const authMiddleware = require('../middleware/auth');
const { validateObjectId } = require('../utils/validateObjectId');
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

/* ── GET /api/bids/:auctionId — ofertele unei licitații ────────
   Reguli de acces:
   - cumpărătorul (proprietarul licitației) vede toate ofertele
   - adminul vede toate ofertele
   - furnizorii care AU ofertat la această licitație văd doar
     propriile lor oferte (nu pot vedea ofertele concurenței)
   - oricine altcineva: 403                                            */
router.get('/:auctionId', authMiddleware, validateObjectId('auctionId'), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.auctionId).select('buyer status');
    if (!auction) return res.status(404).json({ message: 'Licitația nu există' });

    const uid     = req.user.id;
    const isOwner = auction.buyer.toString() === uid;
    const isAdmin = req.user.role === 'admin';

    let bids;
    if (isOwner || isAdmin) {
      /* Acces complet — vede toate ofertele cu informații despre furnizori. */
      bids = await Bid.find({ auction: req.params.auctionId })
        .populate('supplier', 'firstName lastName companyName rating')
        .sort({ amount: 1 });
    } else {
      /* Furnizorul vede doar ofertele proprii — doar dacă a ofertat. */
      const hasOwnBid = await Bid.exists({
        auction:  req.params.auctionId,
        supplier: uid,
      });
      if (!hasOwnBid) {
        logger.fromReq(req).security(EVENTS.BID.UNAUTHORIZED_VIEW || EVENTS.AUCTION.UNAUTHORIZED,
          'Tentativă de vizualizare oferte fără permisiune', {
            entityType: 'auction',
            entityId:   req.params.auctionId,
          });
        return res.status(403).json({ message: 'Acces interzis la oferte' });
      }
      bids = await Bid.find({ auction: req.params.auctionId, supplier: uid })
        .populate('supplier', 'firstName lastName companyName rating')
        .sort({ amount: 1 });
    }

    logger.fromReq(req).debug(EVENTS.BID.WINNING,
      `Fetch oferte pentru licitația ${req.params.auctionId} (${bids.length})`, {
        entityType: 'auction',
        entityId:   req.params.auctionId,
        metadata:   { isOwner, isAdmin, count: bids.length },
      });

    res.json(bids);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
