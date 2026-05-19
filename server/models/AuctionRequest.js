'use strict';

const mongoose = require('mongoose');

/**
 * AuctionRequest — cerere de aprobare pentru editare/ștergere licitație.
 *
 * Lifecycle:
 *   pending → approved | rejected | cancelled
 */
const auctionRequestSchema = new mongoose.Schema({
  type:   {
    type: String,
    enum: ['edit', 'delete'],
    required: true,
  },
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
  },

  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  buyer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },

  // Motivul buyerului (opțional, mai ales pentru ștergere)
  reason:  { type: String, default: '' },

  // Snapshot al datelor propuse (doar pentru tip='edit')
  proposedData: { type: mongoose.Schema.Types.Mixed },

  // Snapshot al datelor curente la momentul cererii (pentru diff view)
  currentData:  { type: mongoose.Schema.Types.Mixed },

  // Motivul adminului la respingere
  adminNote:   { type: String, default: '' },

  // Cine a recenzat și când
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt:  { type: Date },

}, { timestamps: true });

// Indexuri pentru interogări rapide
auctionRequestSchema.index({ auction: 1, status: 1 });
auctionRequestSchema.index({ buyer:   1, createdAt: -1 });
auctionRequestSchema.index({ status:  1, createdAt: -1 });

module.exports = mongoose.model('AuctionRequest', auctionRequestSchema);
