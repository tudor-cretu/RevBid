'use strict';

const router         = require('express').Router();
const Auction        = require('../models/Auction');
const AuctionRequest = require('../models/AuctionRequest');
const Bid            = require('../models/Bid');
const User           = require('../models/User');
const authMiddleware = require('../middleware/auth');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');
const notifyUser     = require('../utils/notify');

// Câmpuri pe care buyerul le poate edita prin approval flow (nu startPrice, nu currentPrice)
const EDITABLE_FIELDS = [
  'title', 'description', 'category', 'tags',
  'targetPrice', 'deadline', 'autoExtend', 'location',
];

// Câmpuri "importante" — vor fi evidențiate în diff view dacă licitația are bids
const IMPORTANT_FIELDS = new Set([
  'targetPrice', 'deadline', 'location', 'category', 'description',
]);

/* ── adminOnly middleware ───────────────────────────────────── */
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acces interzis — doar adminii pot efectua această acțiune' });
  }
  next();
};

/* ── Helper: notifică toți adminii ─────────────────────────── */
async function notifyAdmins(io, text, link) {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    await Promise.all(admins.map(a =>
      notifyUser(io, a._id.toString(), { type: 'approval_request', text, link })
    ));
  } catch (err) {
    console.error('notifyAdmins error:', err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   BUYER ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

/* ── POST /api/auction-requests/:auctionId/edit ─────────────── */
router.post('/:auctionId/edit', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ message: 'Doar cumpărătorii pot solicita editarea licitațiilor' });
    }

    const auction = await Auction.findById(req.params.auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Licitația nu există' });
    }
    if (auction.buyer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Nu ești proprietarul acestei licitații' });
    }
    if (auction.status !== 'active') {
      return res.status(400).json({
        message: 'Approval flow-ul se aplică doar licitațiilor active. Licitațiile draft pot fi editate direct.',
      });
    }

    // Verifică dacă există deja o cerere de editare pending
    const existingEdit = await AuctionRequest.findOne({
      auction: auction._id,
      type:    'edit',
      status:  'pending',
    });
    if (existingEdit) {
      return res.status(409).json({
        message:   'Există deja o cerere de editare în așteptare pentru această licitație.',
        requestId: existingEdit._id,
      });
    }

    // Filtrează câmpurile permise din body
    const proposedData = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        proposedData[field] = req.body[field];
      }
    }

    if (Object.keys(proposedData).length === 0) {
      return res.status(400).json({ message: 'Nu ai specificat nicio modificare' });
    }

    // Snapshot al datelor curente (pentru diff view în admin)
    const currentData = {};
    for (const field of EDITABLE_FIELDS) {
      currentData[field] = auction[field];
    }

    const request = await AuctionRequest.create({
      type:         'edit',
      status:       'pending',
      auction:      auction._id,
      buyer:        req.user.id,
      reason:       req.body.reason?.trim() || '',
      proposedData,
      currentData,
    });

    logger.fromReq(req).audit(
      EVENTS.APPROVAL.REQUEST_EDIT_CREATED,
      `Cerere de editare creată pentru licitația "${auction.title}"`,
      {
        entityType: 'auctionRequest',
        entityId:   request._id.toString(),
        metadata: {
          auctionId:      auction._id.toString(),
          proposedFields: Object.keys(proposedData),
          reason:         req.body.reason || '',
        },
      }
    );

    // Notifică toți adminii
    const io = req.app.get('io');
    await notifyAdmins(io,
      `📝 Cerere editare licitație: "${auction.title}"`,
      `/admin`
    );

    res.status(201).json(request);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── POST /api/auction-requests/:auctionId/delete ───────────── */
router.post('/:auctionId/delete', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ message: 'Doar cumpărătorii pot solicita ștergerea licitațiilor' });
    }

    const auction = await Auction.findById(req.params.auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Licitația nu există' });
    }
    if (auction.buyer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Nu ești proprietarul acestei licitații' });
    }
    if (auction.status !== 'active') {
      return res.status(400).json({
        message: 'Approval flow-ul se aplică doar licitațiilor active.',
      });
    }

    // Verifică dacă există deja o cerere de ștergere pending
    const existingDelete = await AuctionRequest.findOne({
      auction: auction._id,
      type:    'delete',
      status:  'pending',
    });
    if (existingDelete) {
      return res.status(409).json({
        message:   'Există deja o cerere de ștergere în așteptare pentru această licitație.',
        requestId: existingDelete._id,
      });
    }

    const request = await AuctionRequest.create({
      type:    'delete',
      status:  'pending',
      auction: auction._id,
      buyer:   req.user.id,
      reason:  req.body.reason?.trim() || '',
    });

    logger.fromReq(req).audit(
      EVENTS.APPROVAL.REQUEST_DELETE_CREATED,
      `Cerere de ștergere creată pentru licitația "${auction.title}"`,
      {
        entityType: 'auctionRequest',
        entityId:   request._id.toString(),
        metadata: {
          auctionId: auction._id.toString(),
          reason:    req.body.reason || '',
        },
      }
    );

    // Notifică toți adminii
    const io = req.app.get('io');
    await notifyAdmins(io,
      `🗑️ Cerere ștergere licitație: "${auction.title}"`,
      `/admin`
    );

    res.status(201).json(request);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/auction-requests/my ──────────────────────────── */
// Buyer: toate cererile proprii
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const requests = await AuctionRequest.find({ buyer: req.user.id })
      .populate('auction', 'title status currentPrice')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/auction-requests/for/:auctionId ───────────────── */
// Buyer: cererile pentru o licitație specifică
router.get('/for/:auctionId', authMiddleware, async (req, res) => {
  try {
    const filter = { auction: req.params.auctionId };
    // Buyerul vede doar propriile cereri; adminul vede toate
    if (req.user.role !== 'admin') {
      filter.buyer = req.user.id;
    }

    const requests = await AuctionRequest.find(filter).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── DELETE /api/auction-requests/:requestId ────────────────── */
// Buyer: anulează o cerere pending proprie
router.delete('/:requestId', authMiddleware, async (req, res) => {
  try {
    const request = await AuctionRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Cererea nu există' });

    if (request.buyer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Nu poți anula această cerere' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Poți anula doar cereri în așteptare' });
    }

    request.status = 'cancelled';
    await request.save();

    logger.fromReq(req).audit(
      EVENTS.APPROVAL.REQUEST_CANCELLED,
      `Cerere ${request.type} anulată`,
      {
        entityType: 'auctionRequest',
        entityId:   request._id.toString(),
        metadata: { auctionId: request.auction.toString() },
      }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN ENDPOINTS
   ═══════════════════════════════════════════════════════════════ */

/* ── GET /api/auction-requests ──────────────────────────────── */
// Admin: listează toate cererile (cu filtre opționale)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;

    const requests = await AuctionRequest.find(filter)
      .populate('auction',    'title status currentPrice startPrice')
      .populate('buyer',      'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Adaugă numărul de bids pentru fiecare licitație
    const enriched = await Promise.all(requests.map(async (req) => {
      const obj = req.toObject();
      if (obj.auction?._id) {
        obj.bidCount = await Bid.countDocuments({ auction: obj.auction._id });
      }
      return obj;
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PUT /api/auction-requests/:requestId/approve ───────────── */
router.put('/:requestId/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    const request = await AuctionRequest.findById(req.params.requestId)
      .populate('buyer', 'firstName email _id');

    if (!request) return res.status(404).json({ message: 'Cererea nu există' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Cererea nu mai este în așteptare' });
    }

    const auction = await Auction.findById(request.auction);
    if (!auction) return res.status(404).json({ message: 'Licitația nu mai există' });

    if (request.type === 'edit') {
      // Aplică câmpurile propuse pe licitație
      for (const field of EDITABLE_FIELDS) {
        if (request.proposedData?.[field] !== undefined) {
          auction[field] = request.proposedData[field];
        }
      }
      await auction.save();
    } else {
      // Soft delete — preservă relațiile și istoricul
      auction.status = 'cancelled';
      await auction.save();
    }

    request.status     = 'approved';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    logger.fromReq(req).audit(
      EVENTS.APPROVAL.REQUEST_APPROVED,
      `Cerere ${request.type} aprobată pentru licitația "${auction.title}"`,
      {
        entityType: 'auctionRequest',
        entityId:   request._id.toString(),
        metadata: {
          auctionId:      auction._id.toString(),
          type:           request.type,
          approvedBy:     req.user.id,
          proposedFields: request.type === 'edit' ? Object.keys(request.proposedData || {}) : [],
        },
      }
    );

    // Notifică buyerul
    const io = req.app.get('io');
    const notifText = request.type === 'edit'
      ? `✅ Cererea ta de editare pentru "${auction.title}" a fost aprobată!`
      : `✅ Cererea ta de ștergere pentru "${auction.title}" a fost aprobată.`;

    await notifyUser(io, request.buyer._id.toString(), {
      type: 'approval_approved',
      text: notifText,
      link: `/auction/${auction._id}`,
    });

    const populated = await AuctionRequest.findById(request._id)
      .populate('auction',    'title status currentPrice')
      .populate('buyer',      'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName');

    res.json(populated);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PUT /api/auction-requests/:requestId/reject ────────────── */
router.put('/:requestId/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const request = await AuctionRequest.findById(req.params.requestId)
      .populate('buyer', 'firstName email _id');

    if (!request) return res.status(404).json({ message: 'Cererea nu există' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Cererea nu mai este în așteptare' });
    }

    const auction = await Auction.findById(request.auction);
    const auctionTitle = auction?.title || 'licitația';

    request.status     = 'rejected';
    request.adminNote  = req.body.adminNote?.trim() || '';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    logger.fromReq(req).audit(
      EVENTS.APPROVAL.REQUEST_REJECTED,
      `Cerere ${request.type} respinsă pentru licitația "${auctionTitle}"`,
      {
        entityType: 'auctionRequest',
        entityId:   request._id.toString(),
        metadata: {
          auctionId:   request.auction.toString(),
          type:        request.type,
          rejectedBy:  req.user.id,
          adminNote:   req.body.adminNote || '',
        },
      }
    );

    // Notifică buyerul
    const io = req.app.get('io');
    const suffix = request.adminNote ? `: "${request.adminNote}"` : '.';
    const notifText = request.type === 'edit'
      ? `❌ Cererea ta de editare pentru "${auctionTitle}" a fost respinsă${suffix}`
      : `❌ Cererea ta de ștergere pentru "${auctionTitle}" a fost respinsă${suffix}`;

    await notifyUser(io, request.buyer._id.toString(), {
      type: 'approval_rejected',
      text: notifText,
      link: `/auction/${request.auction}`,
    });

    const populated = await AuctionRequest.findById(request._id)
      .populate('auction',    'title status currentPrice')
      .populate('buyer',      'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName');

    res.json(populated);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
