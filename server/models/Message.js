const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:      { type: String, default: '' },
  type:         { type: String, enum: ['text', 'image'], default: 'text' },
  imageUrl:     { type: String, default: null },
  isRead:       { type: Boolean, default: false },
}, { timestamps: true });

/* Indexuri — conversațiile sunt aproape întotdeauna interogate
   filtrate după conversation și sortate după createdAt.            */
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, sender: 1, isRead: 1 });

module.exports = mongoose.model('Message', messageSchema);