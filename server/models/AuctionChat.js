const mongoose = require('mongoose');

const auctionChatSchema = new mongoose.Schema({
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  sender:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('AuctionChat', auctionChatSchema);