const mongoose = require('mongoose');

/* ── Sediu social — adresa oficială a firmei ── */
const companyAddressSchema = new mongoose.Schema({
  country:    { type: String, default: 'România', trim: true },
  county:     { type: String, default: '', trim: true },
  city:       { type: String, default: '', trim: true },
  street:     { type: String, default: '', trim: true },
  number:     { type: String, default: '', trim: true },
  building:   { type: String, default: '', trim: true },
  staircase:  { type: String, default: '', trim: true },
  floor:      { type: String, default: '', trim: true },
  apartment:  { type: String, default: '', trim: true },
  postalCode: { type: String, default: '', trim: true },
}, { _id: false });

/* ── Date companie / date fiscale — pentru documente și invoice-uri.
   Sub-document embeddat: relație 1:1 cu userul, fără join-uri. ── */
const companySchema = new mongoose.Schema({
  legalName:           { type: String, default: '', trim: true }, // Denumirea completă (cu forma juridică)
  taxId:               { type: String, default: '', trim: true }, // C.U.I. / C.I.F.
  tradeRegisterNumber: { type: String, default: '', trim: true }, // Nr. Registrul Comerțului
  address:             { type: companyAddressSchema, default: () => ({}) },
}, { _id: false, timestamps: true });

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

  // Date companie / date fiscale (buyer + supplier)
  company:      { type: companySchema, default: () => ({}) },

  // Verificare email
  verifyCode:       { type: String,  default: null },
  verifyCodeExpiry: { type: Date,    default: null },

  // Resetare parolă — tokenul raw NU se salvează niciodată, doar hash-ul
  resetPasswordTokenHash: { type: String, default: null },
  resetPasswordExpiry:    { type: Date,   default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
