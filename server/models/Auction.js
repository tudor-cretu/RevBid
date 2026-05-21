const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  buyer:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Câmpurile de mai jos NU sunt `required` la nivel de schemă: drafturile pot
  // fi salvate incomplete. Validarea completă se aplică doar la publicare.
  title:        { type: String, default: '', trim: true },
  description:  { type: String, default: '' },
  category:     { type: String, default: '' },
  // Cantitatea cerută — text liber flexibil (ex: „1000 buc", „3 luni", „200 kg").
  quantity:     { type: String, default: '', trim: true },
  tags:         [{ type: String }],
  images:       [{ url: String, publicId: String, order: Number }],
  location: {
    lat:     { type: Number },
    lng:     { type: Number },
    address: { type: String, default: '' },
    city:    { type: String, default: '' },
  },
  startPrice:   { type: Number },
  currentPrice: { type: Number },
  targetPrice:  { type: Number },
  status:       { type: String, enum: ['draft', 'active', 'closed', 'cancelled'], default: 'draft' },
  deadline:     { type: Date },
  publishedAt:  { type: Date, default: null },
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