'use strict';

const router         = require('express').Router();
const Auction        = require('../models/Auction');
const authMiddleware = require('../middleware/auth');
const optionalAuth   = require('../middleware/optionalAuth');
const Bid            = require('../models/Bid');
const Subscription   = require('../models/Subscription');
const AuctionChat    = require('../models/AuctionChat');
const notifyUser     = require('../utils/notify');
const { validateObjectId } = require('../utils/validateObjectId');
const { auctionCreateLimiter, auctionChatLimiter } = require('../middleware/rateLimiters');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');

/* ── Validare pentru PUBLICARE ──────────────────────────────────
   Drafturile pot fi salvate incomplete; la publicare verificăm
   toate câmpurile obligatorii. Întoarce { valid, missing[], errors{} }. */
const PUBLISH_FIELD_LABELS = {
  title:       'Titlu',
  description: 'Descriere',
  category:    'Categorie',
  quantity:    'Cantitate',
  startPrice:  'Buget de pornire',
  deadline:    'Deadline',
};

function validateForPublish(data) {
  const missing = [];
  const errors  = {};

  const str = v => (typeof v === 'string' ? v.trim() : v);

  if (!str(data.title))       { missing.push('title');       errors.title = 'Titlul este obligatoriu.'; }
  if (!str(data.description)) { missing.push('description'); errors.description = 'Descrierea este obligatorie.'; }
  if (!str(data.category))    { missing.push('category');    errors.category = 'Categoria este obligatorie.'; }
  if (!str(data.quantity))    { missing.push('quantity');    errors.quantity = 'Cantitatea este obligatorie.'; }

  const sp = Number(data.startPrice);
  if (data.startPrice === undefined || data.startPrice === null || data.startPrice === '' || isNaN(sp) || sp <= 0) {
    missing.push('startPrice');
    errors.startPrice = 'Bugetul de pornire trebuie să fie un număr pozitiv.';
  }

  if (!data.deadline) {
    missing.push('deadline');
    errors.deadline = 'Deadline-ul este obligatoriu.';
  } else {
    const d = new Date(data.deadline);
    const MIN_DURATION_MS = 5 * 60 * 1000;                  // 5 minute
    const MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000;      // 1 an
    const now = Date.now();
    if (isNaN(d.getTime())) {
      missing.push('deadline');
      errors.deadline = 'Deadline-ul are un format invalid.';
    } else if (d.getTime() <= now + MIN_DURATION_MS) {
      errors.deadline = 'Deadline-ul trebuie să fie cel puțin 5 minute în viitor.';
      if (!missing.includes('deadline')) missing.push('deadline');
    } else if (d.getTime() > now + MAX_DURATION_MS) {
      errors.deadline = 'Deadline-ul nu poate fi mai departe de 1 an în viitor.';
      if (!missing.includes('deadline')) missing.push('deadline');
    }
  }

  /* Validare buget de pornire — limite rezonabile pentru a preveni
     valori absurde sau overflow. */
  if (data.startPrice !== undefined && data.startPrice !== null && data.startPrice !== '') {
    const sp = Number(data.startPrice);
    if (!isNaN(sp) && sp > 0) {
      if (sp > 1_000_000_000) {
        errors.startPrice = 'Bugetul de pornire este nerealist de mare.';
        if (!missing.includes('startPrice')) missing.push('startPrice');
      }
    }
  }

  return { valid: missing.length === 0 && Object.keys(errors).length === 0, missing, errors };
}

/* Normalizează un payload de licitație din req.body (câmpuri permise). */
function pickAuctionFields(body = {}) {
  if (!body || typeof body !== 'object') body = {};
  const out = {};
  if (body.title       !== undefined) out.title       = String(body.title).trim();
  if (body.description !== undefined) out.description = String(body.description).trim();
  if (body.category    !== undefined) out.category    = String(body.category).trim();
  if (body.quantity    !== undefined) out.quantity    = String(body.quantity).trim();
  if (body.tags        !== undefined) out.tags        = Array.isArray(body.tags) ? body.tags : [];
  if (body.location    !== undefined) out.location    = body.location || {};
  if (body.autoExtend  !== undefined) out.autoExtend  = !!body.autoExtend;
  if (body.startPrice  !== undefined)
    out.startPrice = (body.startPrice === '' || body.startPrice === null) ? undefined : Number(body.startPrice);
  if (body.targetPrice !== undefined)
    out.targetPrice = (body.targetPrice === '' || body.targetPrice === null) ? null : Number(body.targetPrice);
  if (body.deadline    !== undefined)
    out.deadline = body.deadline ? new Date(body.deadline) : null;
  return out;
}

/* ── GET /api/auctions ─────────────────────────────────────────
   Drafturile sunt PRIVATE — vizibile doar proprietarului.
   - status absent          → doar licitații active
   - status=draft           → doar drafturile proprii (necesită auth)
   - status=all             → tot ce e public + drafturile proprii
   - status=active/closed…  → filtru exact (fără drafturi străine)        */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, status } = req.query;
    const uid = req.user?.id || null;

    const filter = {};
    if (category) filter.category = category;

    if (!status) {
      filter.status = 'active';
    } else if (status === 'draft') {
      // Drafturi: strict ale utilizatorului curent.
      if (!uid) return res.json([]);
      filter.status = 'draft';
      filter.buyer  = uid;
    } else if (status === 'all') {
      // Tot ce nu e draft + drafturile proprii.
      if (uid) {
        filter.$or = [
          { status: { $ne: 'draft' } },
          { status: 'draft', buyer: uid },
        ];
      } else {
        filter.status = { $ne: 'draft' };
      }
    } else {
      // status concret (active/closed/cancelled) — drafturile nu se ating.
      filter.status = status === 'draft' ? 'active' : status;
    }

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
        metadata: { filter: { category, status } },
      });

    res.json(enriched);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/auctions/:id ─────────────────────────────────────
   Drafturile sunt accesibile doar proprietarului / adminului.      */
router.get('/:id', optionalAuth, validateObjectId('id'), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('buyer', 'firstName lastName companyName email phone avatar rating');

    if (!auction) {
      logger.fromReq(req).warn(EVENTS.AUCTION.NOT_FOUND,
        'Licitație inexistentă accesată', {
          entityType: 'auction',
          entityId:   req.params.id,
        });
      return res.status(404).json({ message: 'Licitația nu există' });
    }

    // Protecție drafturi: vizibile doar proprietarului sau adminului.
    if (auction.status === 'draft') {
      const uid     = req.user?.id || null;
      const ownerId = auction.buyer?._id?.toString() || auction.buyer?.toString();
      const isOwner = uid && uid === ownerId;
      const isAdmin = req.user?.role === 'admin';
      if (!isOwner && !isAdmin) {
        logger.fromReq(req).security(EVENTS.AUCTION.DRAFT_ACCESS_DENIED,
          'Tentativă de accesare a unui draft de către un alt utilizator', {
            entityType: 'auction',
            entityId:   req.params.id,
          });
        return res.status(404).json({ message: 'Licitația nu există' });
      }
    }

    res.json(auction);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── POST /api/auctions ─────────────────────────────────────────
   Body acceptă `status: 'draft' | 'active'`.
   - draft  → se salvează cu orice câmpuri (chiar incomplete)
   - active → se aplică validarea completă de publicare              */
router.post('/', authMiddleware, auctionCreateLimiter, async (req, res) => {
  try {
    if (req.user.role !== 'buyer') {
      logger.fromReq(req).security(EVENTS.AUCTION.UNAUTHORIZED,
        'Furnizor a încercat să creeze licitație', {
          entityType: 'auction',
          metadata:   { role: req.user.role },
        });
      return res.status(403).json({ message: 'Doar cumpărătorii pot crea licitații' });
    }

    const wantsPublish = req.body.status === 'active' || req.body.publish === true;
    const fields       = pickAuctionFields(req.body);

    if (wantsPublish) {
      const { valid, missing, errors } = validateForPublish(fields);
      if (!valid) {
        logger.fromReq(req).warn(EVENTS.AUCTION.PUBLISH_VALIDATION_FAIL,
          'Validare publicare eșuată la crearea licitației', {
            entityType: 'auction',
            metadata:   { missing },
          });
        return res.status(400).json({
          message: 'Completează toate câmpurile obligatorii pentru publicare.',
          missing, errors,
        });
      }
    }

    const auction = await Auction.create({
      buyer:       req.user.id,
      title:       fields.title       || '',
      description: fields.description || '',
      category:    fields.category    || '',
      quantity:    fields.quantity    || '',
      tags:        fields.tags        || [],
      startPrice:  fields.startPrice,
      targetPrice: fields.targetPrice ?? null,
      deadline:    fields.deadline    ?? null,
      autoExtend:  fields.autoExtend  || false,
      location:    fields.location    || {},
      status:      wantsPublish ? 'active' : 'draft',
      publishedAt: wantsPublish ? new Date() : null,
    });

    if (wantsPublish) {
      // La publicare furnizorii ofertează → currentPrice pornește de la startPrice.
      auction.currentPrice = auction.startPrice;
      await auction.save();

      await Subscription.findOneAndUpdate(
        { user: req.user.id, auction: auction._id },
        { user: req.user.id, auction: auction._id },
        { upsert: true, new: true }
      );

      logger.fromReq(req).audit(EVENTS.AUCTION.CREATED,
        `Licitație creată și publicată: "${auction.title}"`, {
          entityType: 'auction',
          entityId:   auction._id.toString(),
          metadata: {
            category:    auction.category,
            quantity:    auction.quantity,
            startPrice:  auction.startPrice,
            targetPrice: auction.targetPrice,
            deadline:    auction.deadline,
          },
        });
    } else {
      logger.fromReq(req).audit(EVENTS.AUCTION.DRAFT_CREATED,
        `Draft licitație creat${auction.title ? `: "${auction.title}"` : ''}`, {
          entityType: 'auction',
          entityId:   auction._id.toString(),
        });
    }

    res.status(201).json(auction);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PUT /api/auctions/:id ──────────────────────────────────────
   Editare directă. Drafturile pot fi editate complet (orice câmp).
   Licitațiile active păstrează lista restrânsă de câmpuri.
   (Modificarea licitațiilor active trece de regulă prin approval flow.) */
router.put('/:id', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Licitația nu există' });

    if (auction.buyer.toString() !== req.user.id) {
      logger.fromReq(req).security(EVENTS.AUCTION.UNAUTHORIZED,
        'Tentativă de editare a licitației altui utilizator', {
          entityType: 'auction',
          entityId:   req.params.id,
          metadata:   { ownerId: auction.buyer.toString() },
        });
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }

    if (auction.status === 'closed' || auction.status === 'cancelled') {
      return res.status(400).json({ message: 'Licitația nu mai poate fi editată' });
    }

    const fields  = pickAuctionFields(req.body);
    const isDraft = auction.status === 'draft';

    // Pentru licitații active nu se permite modificarea bugetului de pornire.
    if (!isDraft) delete fields.startPrice;

    const changedFields = [];
    for (const [k, v] of Object.entries(fields)) {
      auction[k] = v;
      changedFields.push(k);
    }
    // Cât timp e draft, currentPrice urmărește startPrice.
    if (isDraft && fields.startPrice !== undefined) {
      auction.currentPrice = fields.startPrice;
    }

    await auction.save();

    logger.fromReq(req).audit(
      isDraft ? EVENTS.AUCTION.DRAFT_UPDATED : EVENTS.AUCTION.UPDATED,
      `${isDraft ? 'Draft' : 'Licitație'} actualizat(ă)${auction.title ? `: "${auction.title}"` : ''}`, {
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

/* ── POST /api/auctions/:id/publish ─────────────────────────────
   Publică un draft. Aplică (opțional) câmpuri din body, validează
   toate câmpurile obligatorii și trece licitația în starea `active`. */
router.post('/:id/publish', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Licitația nu există' });

    if (auction.buyer.toString() !== req.user.id) {
      logger.fromReq(req).security(EVENTS.AUCTION.UNAUTHORIZED,
        'Tentativă de publicare a licitației altui utilizator', {
          entityType: 'auction',
          entityId:   req.params.id,
        });
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }
    if (auction.status !== 'draft') {
      return res.status(400).json({ message: 'Doar drafturile pot fi publicate.' });
    }

    // Aplică eventualele modificări trimise odată cu publicarea.
    const fields = pickAuctionFields(req.body);
    for (const [k, v] of Object.entries(fields)) auction[k] = v;

    const { valid, missing, errors } = validateForPublish({
      title:       auction.title,
      description: auction.description,
      category:    auction.category,
      quantity:    auction.quantity,
      startPrice:  auction.startPrice,
      deadline:    auction.deadline,
    });

    if (!valid) {
      logger.fromReq(req).warn(EVENTS.AUCTION.PUBLISH_VALIDATION_FAIL,
        'Validare publicare eșuată', {
          entityType: 'auction',
          entityId:   auction._id.toString(),
          metadata:   { missing },
        });
      return res.status(400).json({
        message: 'Completează toate câmpurile obligatorii înainte de publicare.',
        missing, errors,
      });
    }

    auction.status       = 'active';
    auction.publishedAt  = new Date();
    auction.currentPrice = auction.startPrice;
    await auction.save();

    // Cumpărătorul se abonează automat la propria licitație.
    await Subscription.findOneAndUpdate(
      { user: req.user.id, auction: auction._id },
      { user: req.user.id, auction: auction._id },
      { upsert: true, new: true }
    );

    logger.fromReq(req).audit(EVENTS.AUCTION.DRAFT_PUBLISHED,
      `Draft publicat: "${auction.title}"`, {
        entityType: 'auction',
        entityId:   auction._id.toString(),
        metadata: {
          category:   auction.category,
          quantity:   auction.quantity,
          startPrice: auction.startPrice,
          deadline:   auction.deadline,
        },
      });

    res.json(auction);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── DELETE /api/auctions/:id ───────────────────────────────────
   Drafturile se șterg definitiv (nu au relații/istoric).
   Licitațiile publicate se anulează (soft delete).                  */
router.delete('/:id', authMiddleware, validateObjectId('id'), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Licitația nu există' });

    if (auction.buyer.toString() !== req.user.id && req.user.role !== 'admin') {
      logger.fromReq(req).security(EVENTS.AUCTION.UNAUTHORIZED,
        'Tentativă de anulare a licitației fără permisiune', {
          entityType: 'auction',
          entityId:   req.params.id,
          metadata:   { ownerId: auction.buyer.toString() },
        });
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }

    if (auction.status === 'draft') {
      await auction.deleteOne();
      logger.fromReq(req).audit(EVENTS.AUCTION.DRAFT_DELETED,
        `Draft șters${auction.title ? `: "${auction.title}"` : ''}`, {
          entityType: 'auction',
          entityId:   auction._id.toString(),
        });
      return res.json({ message: 'Draftul a fost șters' });
    }

    auction.status = 'cancelled';
    await auction.save();

    logger.fromReq(req).audit(EVENTS.AUCTION.CANCELLED,
      `Licitație anulată: "${auction.title}"`, {
        entityType: 'auction',
        entityId:   auction._id.toString(),
        metadata:   { cancelledBy: req.user.role },
      });

    res.json({ message: 'Licitația a fost anulată' });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GET /api/auctions/:id/chat ─────────────────────────────────── */
router.get('/:id/chat', authMiddleware, validateObjectId('id'), async (req, res) => {
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

/* ── POST /api/auctions/:id/chat ────────────────────────────────── */
router.post('/:id/chat', authMiddleware, auctionChatLimiter, validateObjectId('id'), async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Mesajul e gol' });

    const auction = await Auction.findById(req.params.id);
    if (!auction)                       return res.status(404).json({ message: 'Licitația nu există' });
    if (auction.status !== 'active')    return res.status(400).json({ message: 'Licitația nu e activă' });

    const isBuyer = auction.buyer.toString() === req.user.id;
    const hasBid  = await Bid.exists({ auction: req.params.id, supplier: req.user.id });

    if (!isBuyer && !hasBid) {
      logger.fromReq(req).security(EVENTS.AUCTION.UNAUTHORIZED,
        'Acces refuzat la chat licitație — utilizator fără ofertă', {
          entityType: 'auction',
          entityId:   req.params.id,
        });
      return res.status(403).json({
        message: 'Doar cumpărătorul și furnizorii care au ofertat pot scrie aici',
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
