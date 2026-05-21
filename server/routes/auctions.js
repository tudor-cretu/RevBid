'use strict';

const router         = require('express').Router();
const Auction        = require('../models/Auction');
const authMiddleware = require('../middleware/auth');
const Bid            = require('../models/Bid');
const Subscription   = require('../models/Subscription');
const AuctionChat    = require('../models/AuctionChat');
const notifyUser     = require('../utils/notify');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');

/* ── GET /api/auctions ─────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { category, status } = req.query;
    const filter = {};
    if (category) filter.category = category;
    // status=all → niciun filtru; status absent → default active; altfel filtru exact
    if (status && status !== 'all') filter.status = status;
    else if (!status)               filter.status = 'active';

    const auctions = await Auction.find(filter)
      .populate('buyer', 'firstName lastName companyName')
      .sort({ createdAt: -1 });

    // Agregare oferte: nr. total + cea mai bună (cea mai mică) ofertă per licitație
    const bidStats = await Bid.aggregate([
      { $match: { auction: { $in: auctions.map(a => a._id) } } },
      { $group: { _id: '$auction', bidCount: { $sum: 1 }, lowestBid: { $min: '$amount' } } },
    ]);
    const statsMap = new Map(bidStats.map(s => [s._id.toString(), s]));

    const enriched = auctions.map(a => {
      const obj  = a.toObject();
      const stat = statsMap.get(a._id.toString());
      obj.bidCount  = stat?.bidCount  ?? 0;
      obj.lowestBid = stat?.lowestBid ?? null;
      return obj;
    });

    logger.fromReq(req).debug(EVENTS.AUCTION.FETCH,
      `Fetch licitații (${enriched.length} rezultate)`, {
        metadata: { filter },
      });

    res.json(enriched);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/auctions/:id ─────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('buyer', 'firstName lastName companyName email phone avatar rating');

    if (!auction) {
      logger.fromReq(req).warn(EVENTS.AUCTION.NOT_FOUND,
        'Licitație inexistentă accesată', {
          entityType: 'auction',
          entityId:   req.params.id,
        });
      return res.status(404).json({ message: 'Licitatia nu exista' });
    }

    res.json(auction);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── POST /api/auctions ─────────────────────────────────────── */
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'buyer') {
      logger.fromReq(req).security(EVENTS.AUCTION.UNAUTHORIZED,
        'Furnizor a încercat să creeze licitație', {
          entityType: 'auction',
          metadata:   { role: req.user.role },
        });
      return res.status(403).json({ message: 'Doar cumparatorii pot crea licitatii' });
    }

    const {
      title, description, category, tags,
      startPrice, targetPrice, deadline,
      autoExtend, location,
    } = req.body;

    const auction = await Auction.create({
      buyer: req.user.id,
      title, description, category,
      tags:        tags || [],
      startPrice,
      targetPrice: targetPrice || null,
      deadline:    deadline ? new Date(deadline) : null,
      autoExtend:  autoExtend || false,
      location:    location || {},
      status:      'active',
    });

    await Subscription.findOneAndUpdate(
      { user: req.user.id, auction: auction._id },
      { user: req.user.id, auction: auction._id },
      { upsert: true, new: true }
    );

    logger.fromReq(req).audit(EVENTS.AUCTION.CREATED,
      `Licitație creată: "${title}"`, {
        entityType: 'auction',
        entityId:   auction._id.toString(),
        metadata: {
          category,
          startPrice,
          targetPrice: targetPrice || null,
          deadline:    deadline || null,
          location:    location?.city || null,
        },
      });

    res.status(201).json(auction);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PUT /api/auctions/:id ──────────────────────────────────── */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Licitatia nu exista' });

    if (auction.buyer.toString() !== req.user.id) {
      logger.fromReq(req).security(EVENTS.AUCTION.UNAUTHORIZED,
        'Tentativă de editare a licitației altui utilizator', {
          entityType: 'auction',
          entityId:   req.params.id,
          metadata:   { ownerId: auction.buyer.toString() },
        });
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }

    if (auction.status === 'closed') {
      return res.status(400).json({ message: 'Licitatia e deja inchisa' });
    }

    const allowed = ['title', 'description', 'category', 'tags', 'targetPrice', 'deadline', 'autoExtend', 'location'];
    const changedFields = [];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) {
        auction[field] = req.body[field];
        changedFields.push(field);
      }
    });

    await auction.save();

    logger.fromReq(req).audit(EVENTS.AUCTION.UPDATED,
      `Licitație actualizată: "${auction.title}"`, {
        entityType: 'auction',
        entityId:   auction._id.toString(),
        metadata:   { changedFields },
      });

    res.json(auction);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── DELETE /api/auctions/:id ───────────────────────────────── */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Licitatia nu exista' });

    if (auction.buyer.toString() !== req.user.id && req.user.role !== 'admin') {
      logger.fromReq(req).security(EVENTS.AUCTION.UNAUTHORIZED,
        'Tentativă de anulare a licitației fără permisiune', {
          entityType: 'auction',
          entityId:   req.params.id,
          metadata:   { ownerId: auction.buyer.toString() },
        });
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }

    auction.status = 'cancelled';
    await auction.save();

    logger.fromReq(req).audit(EVENTS.AUCTION.CANCELLED,
      `Licitație anulată: "${auction.title}"`, {
        entityType: 'auction',
        entityId:   auction._id.toString(),
        metadata:   { cancelledBy: req.user.role },
      });

    res.json({ message: 'Licitatia a fost anulata' });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/auctions/:id/chat ─────────────────────────────── */
router.get('/:id/chat', authMiddleware, async (req, res) => {
  try {
    const messages = await AuctionChat.find({ auction: req.params.id })
      .populate('sender', 'firstName lastName avatar role')
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── POST /api/auctions/:id/chat ────────────────────────────── */
router.post('/:id/chat', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Mesajul e gol' });

    const auction = await Auction.findById(req.params.id);
    if (!auction)                       return res.status(404).json({ message: 'Licitatia nu exista' });
    if (auction.status !== 'active')    return res.status(400).json({ message: 'Licitatia nu e activa' });

    const isBuyer = auction.buyer.toString() === req.user.id;
    const hasBid  = await Bid.exists({ auction: req.params.id, supplier: req.user.id });

    if (!isBuyer && !hasBid) {
      logger.fromReq(req).security(EVENTS.AUCTION.UNAUTHORIZED,
        'Acces refuzat la chat licitație — utilizator fără ofertă', {
          entityType: 'auction',
          entityId:   req.params.id,
        });
      return res.status(403).json({
        message: 'Doar cumparatorul si furnizorii care au ofertat pot scrie aici',
      });
    }

    const message   = await AuctionChat.create({
      auction: req.params.id,
      sender:  req.user.id,
      content: content.trim(),
    });
    const populated = await message.populate('sender', 'firstName lastName avatar role');

    const io = req.app.get('io');
    io.to(req.params.id).emit('auction_chat', populated);

    const [subscriptions, bids] = await Promise.all([
      Subscription.find({ auction: req.params.id }).select('user'),
      Bid.find({ auction: req.params.id }).distinct('supplier'),
    ]);

    const recipientIds = new Set([
      auction.buyer.toString(),
      ...subscriptions.map(s => s.user.toString()),
      ...bids.map(b => b.toString()),
    ]);
    recipientIds.delete(req.user.id);

    const notifText = `${populated.sender.firstName} a scris in chat-ul licitatiei "${auction.title}"`;
    const notifPromises = [];
    for (const userId of recipientIds) {
      notifPromises.push(notifyUser(io, userId, {
        type: 'auction_chat',
        text: notifText,
        link: `/auction/${req.params.id}`,
      }));
    }
    await Promise.all(notifPromises);

    res.status(201).json(populated);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
