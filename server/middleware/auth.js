'use strict';

const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');
const EVENTS = require('../utils/events');

/**
 * Middleware de autentificare JWT.
 * Loghează orice tentativă de acces cu token invalid/expirat/lipsă.
 */
module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.fromReq(req).security(EVENTS.AUTH.TOKEN_MISSING,
      'Request fără token de autentificare', {
        metadata: { path: req.path },
      });
    return res.status(401).json({ message: 'Token lipsa' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const eventType = err.name === 'TokenExpiredError'
      ? EVENTS.AUTH.TOKEN_EXPIRED
      : EVENTS.AUTH.TOKEN_INVALID;

    logger.fromReq(req).security(eventType,
      `Token JWT invalid: ${err.message}`, {
        metadata: {
          errorName: err.name,
          path:      req.path,
        },
      });

    return res.status(401).json({ message: 'Token invalid sau expirat' });
  }
};
