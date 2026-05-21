const mongoose = require('mongoose');

/* Review reciproc între buyer și supplierul câștigător al unei licitații.
   Se poate crea doar după confirmarea bilaterală a livrării/primirii. */
const reviewSchema = new mongoose.Schema({
  auction:      { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  reviewer:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  reviewee:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  reviewerRole: { type: String, enum: ['buyer', 'supplier'], required: true },
  revieweeRole: { type: String, enum: ['buyer', 'supplier'], required: true },

  rating:  { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', trim: true, maxlength: 1000 },

  // Moderare — pregătit pentru extensibilitate (dispute / anti-abuse)
  isHidden:     { type: Boolean, default: false },
  hiddenAt:     { type: Date,    default: null },
  hiddenBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

/* Un reviewer poate lăsa un singur review per licitație (fără duplicate). */
reviewSchema.index({ auction: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ reviewee: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
