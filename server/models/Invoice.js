const mongoose = require('mongoose');

/* Invoice / Rezumat tranzacție — document informativ generat la
   finalizarea unei licitații cu câștigător.

   Câmpurile snapshot (auctionTitle, buyerName, amount etc.) sunt
   copiate la generare, astfel încât documentul rămâne stabil chiar
   dacă licitația sau conturile se modifică ulterior. */

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true },

  auction:    { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true, unique: true },
  buyer:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  supplier:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  winningBid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid',     default: null },

  // Snapshot tranzacție
  amount:        { type: Number, required: true },
  currency:      { type: String, default: 'RON' },
  auctionTitle:  { type: String, default: '' },
  category:      { type: String, default: '' },
  description:   { type: String, default: '' },
  buyerName:     { type: String, default: '' },
  supplierName:  { type: String, default: '' },
  deadline:      { type: Date,   default: null },
  finalizedAt:   { type: Date,   default: null },

  status: {
    type: String,
    enum: ['pending', 'generated', 'sent', 'failed', 'voided', 'regenerated'],
    default: 'generated',
  },

  generatedAt:      { type: Date, default: Date.now },
  emailedAtBuyer:   { type: Date, default: null },
  emailedAtSupplier:{ type: Date, default: null },
}, { timestamps: true });

invoiceSchema.index({ buyer: 1 });
invoiceSchema.index({ supplier: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
