const mongoose = require('mongoose');

/* Invoice / Rezumat tranzacție — document informativ generat la
   finalizarea unei licitații cu câștigător.

   Câmpurile snapshot (auctionTitle, buyerName, amount etc.) sunt
   copiate la generare, astfel încât documentul rămâne stabil chiar
   dacă licitația sau conturile se modifică ulterior. */

/* Snapshot date companie — copiat la generare, stabil în timp. */
const companySnapshotSchema = new mongoose.Schema({
  legalName:           { type: String, default: '' },
  taxId:               { type: String, default: '' },
  tradeRegisterNumber: { type: String, default: '' },
  address: {
    country:    { type: String, default: '' },
    county:     { type: String, default: '' },
    city:       { type: String, default: '' },
    street:     { type: String, default: '' },
    number:     { type: String, default: '' },
    building:   { type: String, default: '' },
    staircase:  { type: String, default: '' },
    floor:      { type: String, default: '' },
    apartment:  { type: String, default: '' },
    postalCode: { type: String, default: '' },
  },
  addressText:         { type: String, default: '' },
}, { _id: false });

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

  // Snapshot date companie / date fiscale (la finalizarea licitației)
  buyerCompany:    { type: companySnapshotSchema, default: null },
  supplierCompany: { type: companySnapshotSchema, default: null },

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
