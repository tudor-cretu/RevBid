'use strict';

const router         = require('express').Router();
const mongoose       = require('mongoose');
const authMiddleware = require('../middleware/auth');
const Notification   = require('../models/Notification');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');

/* ── Maparea tipurilor de notificări pe categorii ─────────────────
   Folosește exclusiv tipurile reale emise de notifyUser în aplicație. */
const CATEGORY_TYPES = {
  licitatii: ['auction_won', 'auction_ended', 'auction_lost', 'auction_watch_ended', 'auction_closed'],
  oferte:    ['bid', 'outbid'],
  approvals: ['approval_request', 'approval_approved', 'approval_rejected'],
  mesaje:    ['message', 'auction_chat'],
  review:    ['review_ready', 'review_received', 'delivery_confirmed', 'receipt_confirmed'],
};
const KNOWN_TYPES = Object.values(CATEGORY_TYPES).flat();

const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Construiește filtrul Mongo pentru lista de notificări. */
function buildFilter(userId, { filter, search }) {
  const q = { user: userId };

  if (filter === 'unread')       q.read = false;
  else if (filter === 'read')    q.read = true;
  else if (filter === 'sistem')  q.type = { $nin: KNOWN_TYPES };
  else if (CATEGORY_TYPES[filter]) q.type = { $in: CATEGORY_TYPES[filter] };

  if (search && search.trim()) {
    q.text = { $regex: escapeRegex(search.trim()), $options: 'i' };
  }
  return q;
}

/* ── GET /api/notifications — ultimele 50 (folosit de dropdown/bell) ── */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/notifications/list — listare paginată cu filtre + search ── */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const q     = buildFilter(req.user.id, req.query);

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments(q),
      Notification.countDocuments({ user: req.user.id, read: false }),
    ]);

    logger.fromReq(req).debug(EVENTS.NOTIFICATION.LIST_VIEWED,
      `Notificări listate (${items.length}/${total})`, {
        metadata: { page, filter: req.query.filter || 'all', hasSearch: !!req.query.search },
      });

    res.json({
      items, total, page,
      pages: Math.ceil(total / limit) || 1,
      limit, unreadCount,
    });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PUT /api/notifications/read — marchează toate ca citite ──────── */
router.put('/read', authMiddleware, async (req, res) => {
  try {
    const r = await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true }
    );
    logger.fromReq(req).audit(EVENTS.NOTIFICATION.MARK_ALL_READ,
      'Toate notificările marcate ca citite', {
        metadata: { modified: r.modifiedCount ?? r.nModified ?? 0 },
      });
    res.json({ success: true, unreadCount: 0 });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── DELETE /api/notifications — șterge toate notificările userului ── */
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const r = await Notification.deleteMany({ user: req.user.id });
    logger.fromReq(req).audit(EVENTS.NOTIFICATION.CLEARED_ALL,
      'Toate notificările șterse', {
        metadata: { deleted: r.deletedCount || 0 },
      });
    res.json({ success: true });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PATCH /api/notifications/:id — marchează citită / necitită ───── */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Notificarea nu există' });
    }

    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ message: 'Notificarea nu există' });

    if (notif.user.toString() !== req.user.id) {
      logger.fromReq(req).security(EVENTS.NOTIFICATION.ACCESS_DENIED,
        'Tentativă de modificare a notificării altui utilizator', {
          entityType: 'notification', entityId: req.params.id,
        });
      return res.status(403).json({ message: 'Nu ai acces la această notificare' });
    }

    if (typeof req.body?.read === 'boolean') notif.read = req.body.read;
    await notif.save();

    logger.fromReq(req).audit(
      notif.read ? EVENTS.NOTIFICATION.MARKED_READ : EVENTS.NOTIFICATION.MARKED_UNREAD,
      `Notificare marcată ca ${notif.read ? 'citită' : 'necitită'}`, {
        entityType: 'notification', entityId: notif._id.toString(),
      });

    const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });
    res.json({ notification: notif, unreadCount });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── DELETE /api/notifications/:id — șterge o notificare ──────────── */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Notificarea nu există' });
    }

    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ message: 'Notificarea nu există' });

    if (notif.user.toString() !== req.user.id) {
      logger.fromReq(req).security(EVENTS.NOTIFICATION.ACCESS_DENIED,
        'Tentativă de ștergere a notificării altui utilizator', {
          entityType: 'notification', entityId: req.params.id,
        });
      return res.status(403).json({ message: 'Nu ai acces la această notificare' });
    }

    await notif.deleteOne();

    logger.fromReq(req).audit(EVENTS.NOTIFICATION.DELETED,
      'Notificare ștearsă', {
        entityType: 'notification', entityId: req.params.id,
      });

    const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });
    res.json({ success: true, unreadCount });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
