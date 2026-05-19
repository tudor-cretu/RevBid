'use strict';

const router         = require('express').Router();
const User           = require('../models/User');
const Auction        = require('../models/Auction');
const authMiddleware = require('../middleware/auth');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');

/* ── Middleware — doar admin ──────────────────────────────────── */
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    logger.fromReq(req).security(EVENTS.ADMIN.ACCESS_DENIED,
      'Acces la rută admin refuzat — rol insuficient', {
        entityType: 'route',
        metadata:   { route: req.path, role: req.user.role },
      });
    return res.status(403).json({ message: 'Acces interzis' });
  }
  next();
};

/* ── GET /api/admin/users ────────────────────────────────────── */
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });

    logger.fromReq(req).audit(EVENTS.ADMIN.LIST_USERS,
      `Admin a listat toți utilizatorii (${users.length})`, {
        metadata: { count: users.length },
      });

    res.json(users);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PUT /api/admin/users/:id/ban ────────────────────────────── */
router.put('/users/:id/ban', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: req.body.isBanned },
      { new: true }
    ).select('-passwordHash');

    const action    = req.body.isBanned ? 'banat' : 'debanat';
    const eventType = req.body.isBanned ? EVENTS.ADMIN.USER_BANNED : EVENTS.ADMIN.USER_UNBANNED;

    logger.fromReq(req).audit(eventType,
      `Admin a ${action} utilizatorul ${req.params.id}`, {
        entityType: 'user',
        entityId:   req.params.id,
        metadata:   { isBanned: req.body.isBanned, targetRole: user?.role },
      });

    res.json(user);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/admin/auctions ─────────────────────────────────── */
router.get('/auctions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate('buyer', 'firstName lastName')
      .sort({ createdAt: -1 });

    logger.fromReq(req).audit(EVENTS.ADMIN.LIST_AUCTIONS,
      `Admin a listat toate licitațiile (${auctions.length})`, {
        metadata: { count: auctions.length },
      });

    res.json(auctions);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PUT /api/admin/auctions/:id/close ───────────────────────── */
router.put('/auctions/:id/close', authMiddleware, adminOnly, async (req, res) => {
  try {
    const auction = await Auction.findByIdAndUpdate(
      req.params.id,
      { status: 'closed' },
      { new: true }
    );

    logger.fromReq(req).audit(EVENTS.ADMIN.AUCTION_CLOSED,
      `Admin a închis forțat licitația "${auction?.title}"`, {
        entityType: 'auction',
        entityId:   req.params.id,
        metadata:   { previousStatus: 'active', newStatus: 'closed' },
      });

    res.json(auction);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
