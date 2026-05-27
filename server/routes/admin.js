'use strict';

const router         = require('express').Router();
const User           = require('../models/User');
const Auction        = require('../models/Auction');
const Bid            = require('../models/Bid');
const Invoice        = require('../models/Invoice');
const authMiddleware = require('../middleware/auth');
const { validateObjectId } = require('../utils/validateObjectId');
const { recordAdminAction } = require('../utils/adminAudit');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');
const { finalizeAuctionNotifications } = require('../services/auctionNotify');

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

/* ── GET /api/admin/users ──────────────────────────────────────
   Paginat — împiedică încărcarea a mii de useri într-o singură cerere.
   Query: ?page=1&limit=20&search=...&role=buyer|supplier|admin       */
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};

    /* Filtrare după rol — whitelist strict pentru a preveni injection. */
    if (req.query.role && ['buyer', 'supplier', 'admin'].includes(req.query.role)) {
      filter.role = req.query.role;
    }

    /* Căutare textuală — escape pentru regex, doar pe email/firstName/lastName/companyName. */
    if (req.query.search && typeof req.query.search === 'string') {
      const term = req.query.search.trim().slice(0, 100);
      if (term) {
        const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx   = new RegExp(safe, 'i');
        filter.$or = [
          { email:       rx },
          { firstName:   rx },
          { lastName:    rx },
          { companyName: rx },
        ];
      }
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -verifyCode -verifyCodeExpiry -resetPasswordTokenHash -resetPasswordExpiry')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    logger.fromReq(req).audit(EVENTS.ADMIN.LIST_USERS,
      `Admin a listat utilizatorii (pagina ${page}, ${users.length}/${total})`, {
        metadata: { page, limit, total, filter: Object.keys(filter) },
      });

    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PUT /api/admin/users/:id/ban ────────────────────────────── */
router.put('/users/:id/ban', authMiddleware, adminOnly, validateObjectId('id'), async (req, res) => {
  try {
    /* Snapshot înainte de modificare — pentru audit trail. */
    const before = await User.findById(req.params.id).select('isBanned role email');
    if (!before) return res.status(404).json({ message: 'Utilizator inexistent' });

    /* Refuz auto-ban — un admin nu se poate bana singur. */
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Nu te poți bana pe tine însuți' });
    }

    /* Refuz banarea altor admini fără efort suplimentar. */
    if (before.role === 'admin') {
      return res.status(403).json({ message: 'Nu se pot bana alți admini' });
    }

    const isBanned = !!req.body.isBanned;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned },
      { new: true }
    ).select('-passwordHash');

    const action    = isBanned ? 'banat' : 'debanat';
    const eventType = isBanned ? EVENTS.ADMIN.USER_BANNED : EVENTS.ADMIN.USER_UNBANNED;

    logger.fromReq(req).audit(eventType,
      `Admin a ${action} utilizatorul ${req.params.id}`, {
        entityType: 'user',
        entityId:   req.params.id,
        metadata:   { isBanned, targetRole: user?.role },
      });

    /* Audit trail persistent — append-only. */
    await recordAdminAction(req, {
      action:     isBanned ? 'user.ban' : 'user.unban',
      entityType: 'user',
      entityId:   req.params.id,
      before:     { isBanned: before.isBanned },
      after:      { isBanned },
      reason:     typeof req.body.reason === 'string' ? req.body.reason.slice(0, 500) : '',
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
      .populate('buyer', 'firstName lastName companyName')
      .sort({ createdAt: -1 });

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

    logger.fromReq(req).audit(EVENTS.ADMIN.LIST_AUCTIONS,
      `Admin a listat toate licitațiile (${enriched.length})`, {
        metadata: { count: enriched.length },
      });

    res.json(enriched);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PUT /api/admin/auctions/:id/close ───────────────────────── */
router.put('/auctions/:id/close', authMiddleware, adminOnly, validateObjectId('id'), async (req, res) => {
  try {
    const before = await Auction.findById(req.params.id).select('status title');
    if (!before) return res.status(404).json({ message: 'Licitația nu există' });

    const auction = await Auction.findByIdAndUpdate(
      req.params.id,
      { status: 'closed' },
      { new: true }
    );

    logger.fromReq(req).audit(EVENTS.ADMIN.AUCTION_CLOSED,
      `Admin a închis forțat licitația "${auction?.title}"`, {
        entityType: 'auction',
        entityId:   req.params.id,
        metadata:   { previousStatus: before.status, newStatus: 'closed' },
      });

    /* Audit trail persistent — append-only. */
    await recordAdminAction(req, {
      action:     'auction.force_close',
      entityType: 'auction',
      entityId:   req.params.id,
      before:     { status: before.status, title: before.title },
      after:      { status: 'closed' },
      reason:     typeof req.body.reason === 'string' ? req.body.reason.slice(0, 500) : '',
    });

    res.json(auction);

    /* Flow complet de notificare a finalizării (in-app + email + pop-up live).
       Rulează după răspuns; idempotent prin flag-ul endNotificationsSent. */
    if (auction) {
      finalizeAuctionNotifications(req.app.get('io'), auction._id);
    }
    return;
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/admin/invoices ─────────────────────────────────── */
router.get('/invoices', authMiddleware, adminOnly, async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('buyer',    'firstName lastName')
      .populate('supplier', 'firstName lastName')
      .populate('auction',  'title')
      .sort({ createdAt: -1 });

    logger.fromReq(req).audit(EVENTS.INVOICE.ADMIN_LIST,
      `Admin a listat documentele de tranzacție (${invoices.length})`, {
        metadata: { count: invoices.length },
      });

    res.json(invoices);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/admin/audit ────────────────────────────────────────
   Returnează istoricul acțiunilor admin (paginat, sortat descrescător).
   Query: ?page=1&limit=50&entityType=user&entityId=...&action=user.ban */
router.get('/audit', authMiddleware, adminOnly, async (req, res) => {
  try {
    const AdminAuditLog = require('../models/AdminAuditLog');

    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.entityType) filter.entityType = String(req.query.entityType).slice(0, 50);
    if (req.query.entityId)   filter.entityId   = String(req.query.entityId).slice(0, 50);
    if (req.query.action)     filter.action     = String(req.query.action).slice(0, 100);

    const [entries, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .populate('admin', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AdminAuditLog.countDocuments(filter),
    ]);

    res.json({
      data: entries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
