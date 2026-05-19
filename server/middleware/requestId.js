'use strict';

/**
 * Middleware — Request ID
 * ─────────────────────────────────────────────────────────────────
 * Generează un UUID unic pentru fiecare request HTTP și îl atașează
 * la req.requestId și la headerul de răspuns X-Request-Id.
 *
 * Dacă clientul trimite deja X-Request-Id, îl reutilizăm (correlation).
 */

const { randomUUID } = require('crypto');

module.exports = function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
