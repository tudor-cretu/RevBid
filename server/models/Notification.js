const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:  { type: String, default: 'info' },   // 'bid' | 'outbid' | 'auction_chat' | 'message' | 'auction_closed'
  text:  { type: String, required: true },
  link:  { type: String, default: '/' },
  read:  { type: Boolean, default: false },
}, { timestamps: true });

// Index to quickly find unread for a user
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
