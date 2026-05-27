const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  auction:   { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  supplier:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:    { type: Number, required: true },
  message:   { type: String, default: '' },
  isWinning: { type: Boolean, default: false },
}, { timestamps: true });

/* ── Indexuri ────────────────────────────────────────────────────
   - (auction, amount asc) → list / lowestBid query
   - (auction, isWinning)  → găsirea câștigătorului curent
   - (supplier, createdAt) → istoric oferte furnizor
   - (supplier, isWinning) → ofertele câștigate ale unui furnizor      */
bidSchema.index({ auction: 1, amount: 1 });
bidSchema.index({ auction: 1, isWinning: 1 });
bidSchema.index({ supplier: 1, createdAt: -1 });
bidSchema.index({ supplier: 1, isWinning: 1 });

module.exports = mongoose.model('Bid', bidSchema);