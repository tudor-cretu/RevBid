const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
}, { timestamps: true });

subscriptionSchema.index({ user: 1, auction: 1 }, { unique: true });
/* Necesar pentru bidSocket: "toți abonații la licitația X" */
subscriptionSchema.index({ auction: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);