const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName:    { type: String, required: true, trim: true },
  lastName:     { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, default: null }, // null pentru useri Google
  role:         { type: String, enum: ['buyer', 'supplier', 'admin'], default: 'buyer' },
  companyName:  { type: String, default: '' },
  phone:        { type: String, default: '' },
  rating:       { type: Number, default: 0 },
  reviewCount:  { type: Number, default: 0 },
  isVerified:   { type: Boolean, default: false },
  isBanned:     { type: Boolean, default: false },
  googleId:     { type: String, default: null }, // pentru OAuth
  avatar:       { type: String, default: null }, // poza Google
  city:           { type: String, default: '' },
  avatarPublicId: { type: String, default: null },

  // Verificare email
  verifyCode:       { type: String,  default: null },
  verifyCodeExpiry: { type: Date,    default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);