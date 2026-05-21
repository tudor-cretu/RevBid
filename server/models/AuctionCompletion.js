const mongoose = require('mongoose');

/* Workflow post-licitație: confirmarea bilaterală a livrării/primirii.
   Se creează la prima interacțiune post-finalizare (lazy, din Invoice).
   Review-urile reciproce devin disponibile doar după ambele confirmări. */
const auctionCompletionSchema = new mongoose.Schema({
  auction:    { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true, unique: true },
  buyer:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  supplier:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  winningBid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid',     default: null },

  // Confirmarea furnizorului câștigător — a livrat produsul / a prestat serviciul
  supplierDeliveryConfirmed:   { type: Boolean, default: false },
  supplierDeliveryConfirmedAt: { type: Date,    default: null },

  // Confirmarea cumpărătorului — a primit produsul / serviciul
  buyerReceiptConfirmed:   { type: Boolean, default: false },
  buyerReceiptConfirmedAt: { type: Date,    default: null },

  // Momentul în care ambele părți au confirmat (review-uri deblocate)
  readyForReviewAt: { type: Date, default: null },
  // Momentul în care ambele părți au lăsat review (colaborare încheiată)
  completedAt:      { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AuctionCompletion', auctionCompletionSchema);
