const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  auction:   { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  supplier:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:    { type: Number, required: true },
  message:   { type: String, default: '' },
  isWinning: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Bid', bidSchema);