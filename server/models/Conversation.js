const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  auction:      { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null },
  lastMessage:  { type: String, default: '' },
  lastMessageAt:{ type: Date, default: Date.now },
  unreadCount:  { type: Map, of: Number, default: {} },
}, { timestamps: true });

/* Indexuri — căutarea conversațiilor unui user e cea mai frecventă. */
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ auction: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);