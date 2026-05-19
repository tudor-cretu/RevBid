'use strict';

/**
 * Middleware — Request Logger
 * ─────────────────────────────────────────────────────────────────
 * Loghează fiecare request HTTP la intrare și la ieșire cu timing.
 * Exclude health checks și rute statice pentru a reduce noise-ul.
 */

const logger = require('../utils/logger');
const EVENTS = require('../utils/events');

/* Rute excluse din logging (prea frecvente sau neinteresante) */
const EXCLUDED_PATHS = new Set(['/', '/favicon.ico']);

module.exports = function requestLogger(req, res, next) {
  /* Sare rutele excluse */
  if (EXCLUDED_PATHS.has(req.path)) return next();

  const startedAt = Date.now();

  /* Log la intrare — nivel debug (nu aglomerăm info) */
  logger.fromReq(req).debug(EVENTS.HTTP.REQUEST, `→ ${req.method} ${req.path}`, {
    query: Object.keys(req.query).length ? req.query : undefined,
  });

  /* Interceptăm finalizarea response-ului */
  res.on('finish', () => {
    const durationMs  = Date.now() - startedAt;
    const statusCode  = res.statusCode;

    const meta = {
      statusCode,
      durationMs,
    };

    /* Alegem nivelul de log în funcție de status code */
    if (statusCode >= 500) {
      logger.fromReq(req).error(EVENTS.HTTP.ERROR_5XX,
        `← ${req.method} ${req.path} ${statusCode} (${durationMs}ms)`, meta);
    } else if (statusCode >= 400) {
      logger.fromReq(req).warn(EVENTS.HTTP.ERROR_4XX,
        `← ${req.method} ${req.path} ${statusCode} (${durationMs}ms)`, meta);
    } else {
      logger.fromReq(req).info(EVENTS.HTTP.RESPONSE,
        `← ${req.method} ${req.path} ${statusCode} (${durationMs}ms)`, meta);
    }
  });

  next();
};
