'use strict';

const jwt = require('jsonwebtoken');

/**
 * Middleware de autentificare opțională.
 *
 * Spre deosebire de `authMiddleware`, NU respinge requesturile fără token —
 * pur și simplu populează `req.user` dacă tokenul este prezent și valid.
 * Folosit pe rute publice care își ajustează comportamentul pentru
 * utilizatorii autentificați (ex: ascunderea drafturilor altor cumpărători).
 */
module.exports = function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Token invalid/expirat — tratăm requestul ca neautentificat.
      req.user = null;
    }
  }

  next();
};
