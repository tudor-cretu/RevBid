'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const logger    = require('../utils/logger');
const EVENTS    = require('../utils/events');

/**
 * Cheia per-utilizator: dacă e autentificat, cheia e ID-ul de user,
 * altfel IP-ul. Asta evită ca mai mulți useri în spatele aceluiași
 * NAT (universitate, birou) să se blocheze reciproc.
 *
 * ipKeyGenerator() normalizează IPv6 (eg. /56 prefix) ca să nu poată
 * fi ocolit prin schimbarea adresei.
 */
const keyByUserOrIp = (req, res) => {
  if (req.user?.id) return `u:${req.user.id}`;
  return `ip:${ipKeyGenerator(req, res)}`;
};

/* Handler comun — loghează depășirea limitei ca eveniment de securitate. */
const buildHandler = (eventName) => (req, res, next, options) => {
  try {
    logger.fromReq(req).security(EVENTS.AUTH.RESET_RATE_LIMITED || EVENTS.SYSTEM.UNHANDLED_ERROR,
      `Rate limit depășit: ${eventName}`, {
        metadata: { path: req.path, method: req.method },
      });
  } catch { /* ignore logging errors */ }
  res.status(options.statusCode).json({
    message: 'Prea multe cereri. Încearcă din nou mai târziu.',
  });
};

/* ── Mesaje (DM între useri) — max 30 mesaje/min/user ───────── */
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      30,
  keyGenerator:    keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         buildHandler('message'),
});

/* ── Recenzii — max 5 review-uri/zi/user ─────────────────────── */
const reviewLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max:      5,
  keyGenerator:    keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         buildHandler('review'),
});

/* ── Descărcări facturi — max 20/min/user ────────────────────── */
const invoiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      20,
  keyGenerator:    keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         buildHandler('invoice'),
});

/* ── Creare licitație — max 20/oră/buyer ─────────────────────── */
const auctionCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      20,
  keyGenerator:    keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         buildHandler('auction-create'),
});

/* ── Form de support — max 3 mesaje/oră/IP ───────────────────── */
const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      3,
  keyGenerator:    keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         buildHandler('support'),
});

/* ── Chat licitație — max 60 mesaje/min/user ─────────────────── */
const auctionChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      60,
  keyGenerator:    keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         buildHandler('auction-chat'),
});

/* ── Upload — max 30/oră/user (imagini sunt grele) ───────────── */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      30,
  keyGenerator:    keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         buildHandler('upload'),
});

/* ── Approval flow (edit/delete request) — max 10/oră/user ──── */
const approvalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      10,
  keyGenerator:    keyByUserOrIp,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         buildHandler('approval'),
});

module.exports = {
  messageLimiter,
  reviewLimiter,
  invoiceLimiter,
  auctionCreateLimiter,
  supportLimiter,
  auctionChatLimiter,
  uploadLimiter,
  approvalLimiter,
};
