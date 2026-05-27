'use strict';

const AdminAuditLog = require('../models/AdminAuditLog');
const logger        = require('./logger');
const EVENTS        = require('./events');

/**
 * Înregistrează o acțiune admin în istoricul persistent.
 * Nu aruncă niciodată erori — eșecul logging-ului NU trebuie să blocheze
 * acțiunea de business. Doar logăm către file logger ca fallback.
 *
 * Folosire:
 *   await recordAdminAction(req, {
 *     action: 'user.ban',
 *     entityType: 'user',
 *     entityId: targetUser._id,
 *     before: { isBanned: false },
 *     after:  { isBanned: true },
 *     reason: 'Comportament abuziv',
 *   });
 */
async function recordAdminAction(req, {
  action,
  entityType = '',
  entityId   = '',
  before     = null,
  after      = null,
  reason     = '',
}) {
  try {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '').trim();

    await AdminAuditLog.create({
      admin:      req.user?.id,
      adminEmail: req.user?.email || '',
      action,
      entityType,
      entityId:   entityId ? String(entityId) : '',
      before,
      after,
      reason,
      ip,
      userAgent:  (req.headers['user-agent'] || '').slice(0, 500),
      requestId:  req.id || '',
    });
  } catch (err) {
    /* Fallback la file logger — nu blocăm flow-ul de business. */
    logger.fromReq(req).error(EVENTS.SYSTEM.UNHANDLED_ERROR,
      `Failed to persist admin audit log: ${err.message}`, {
        metadata: { action, entityType, entityId: String(entityId) },
      });
  }
}

module.exports = { recordAdminAction };
