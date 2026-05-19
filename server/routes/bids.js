'use strict';

const router         = require('express').Router();
const Bid            = require('../models/Bid');
const authMiddleware = require('../middleware/auth');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');

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

/* ── GET /api/bids/my — ofertele furnizorului logat ─────────── */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const bids = await Bid.find({ supplier: req.user.id })
      .populate('auction', 'title currentPrice status')
      .sort({ createdAt: -1 });

    res.json(bids);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
