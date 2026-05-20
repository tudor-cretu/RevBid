const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  buyer:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:        { type: String, required: true, trim: true },
  description:  { type: String, required: true },
  category:     { type: String, required: true },
  tags:         [{ type: String }],
  images:       [{ url: String, publicId: String, order: Number }],
  location: {
    lat:     { type: Number },
    lng:     { type: Number },
    address: { type: String, default: '' },
    city:    { type: String, default: '' },
  },
  startPrice:   { type: Number, required: true },
  currentPrice: { type: Number },
  targetPrice:  { type: Number },
  status:       { type: String, enum: ['draft', 'active', 'closed', 'cancelled'], default: 'draft' },
  deadline:     { type: Date },
  autoExtend:   { type: Boolean, default: false },
  winningBid:   { type: mongoose.Schema.Types.ObjectId, ref: 'Bid', default: null },

  // Notificarea de finalizare — flag idempotent ca să nu trimitem de mai multe ori
  endNotificationsSent: { type: Boolean, default: false },
  endedNotifiedAt:      { type: Date,    default: null },
}, { timestamps: true });

// La creare, currentPrice = startPrice
auctionSchema.pre('save', function () {
  if (this.isNew) this.currentPrice = this.startPrice;
});

module.exports = mongoose.model('Auction', auctionSchema);