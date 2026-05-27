'use strict';

const mongoose = require('mongoose');

/**
 * AdminAuditLog — istoric persistent al acțiunilor admin.
 *
 * Spre deosebire de log-urile aplicației (utils/logger.js), care sunt
 * scrise în fișiere și pot fi rotite/șterse, aceste înregistrări trăiesc
 * în baza de date și servesc drept dovezi forensice.
 *
 * IMPORTANT: nu se șterg niciodată din cod — doar manual de DBA.
 * Modelul nu expune metode de delete/update — append-only by convention.
 */
const adminAuditLogSchema = new mongoose.Schema({
  /* Cine a efectuat acțiunea — admin-ul */
  admin: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  adminEmail: { type: String, default: '' },

  /* Tip de acțiune — string liber dar normalizat (ex: 'user.ban', 'auction.close') */
  action: { type: String, required: true, index: true },

  /* Entitate țintă */
  entityType: { type: String, default: '' },          // ex: 'user', 'auction', 'invoice', 'auctionRequest'
  entityId:   { type: String, default: '' },          // ID stringificat al entității

  /* Snapshot date înainte / după modificare — orice JSON */
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after:  { type: mongoose.Schema.Types.Mixed, default: null },

  /* Metadata adițională (motiv, IP, user-agent) */
  reason:    { type: String, default: '' },
  ip:        { type: String, default: '' },
  userAgent: { type: String, default: '' },
  requestId: { type: String, default: '' },
}, {
  timestamps:        true,
  /* Refuzăm orice modificare ulterioară a documentelor — append-only. */
  minimize: false,
});

/* Pentru raportare: cele mai recente acțiuni, filtrabile după entitate. */
adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
