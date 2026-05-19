const router         = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Conversation   = require('../models/Conversation');
const Message        = require('../models/Message');
const { upload, cloudinary } = require('../config/cloudinary');

// GET /api/messages — toate conversatiile userului
router.get('/', authMiddleware, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id
    })
      .populate('participants', 'firstName lastName avatar role companyName')
      .populate('auction', 'title')
      .sort({ lastMessageAt: -1 });

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// POST /api/messages/conversation — creeaza sau gaseste conversatie existenta
router.post('/conversation', authMiddleware, async (req, res) => {
  try {
    const { recipientId, auctionId } = req.body;

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.id, recipientId] },
      auction: auctionId ? auctionId : { $in: [null, undefined] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user.id, recipientId],
        auction:      auctionId || null,
      });
    }

    await conversation.populate('participants', 'firstName lastName avatar role companyName');
    if (auctionId) await conversation.populate('auction', 'title');

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// GET /api/messages/:conversationId — mesajele unei conversatii
router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversatie negasita' });

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({ message: 'Acces interzis' });
    }

    const messages = await Message.find({ conversation: req.params.conversationId })
      .populate('sender', 'firstName lastName avatar')
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { conversation: req.params.conversationId, sender: { $ne: req.user.id }, isRead: false },
      { isRead: true }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// POST /api/messages/:conversationId — trimite mesaj text
router.post('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Mesajul e gol' });

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversatie negasita' });

    if (!conversation.participants.map(p => p.toString()).includes(req.user.id)) {
      return res.status(403).json({ message: 'Acces interzis' });
    }

    const message = await Message.create({
      conversation: req.params.conversationId,
      sender:       req.user.id,
      content:      content.trim(),
      type:         'text',
    });

    conversation.lastMessage   = content.trim();
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populated = await message.populate('sender', 'firstName lastName avatar');

    const io = req.app.get('io');

    // Emit mesaj catre ceilalti participanti (pentru chat live)
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== req.user.id) {
        io.to(`user_${participantId}`).emit('new_message', {
          conversationId: req.params.conversationId,
          message:        populated,
        });

        // Notificare separata pentru Navbar
        io.to(`user_${participantId}`).emit('notification', {
          type: 'message',
          text: `${populated.sender.firstName} ${populated.sender.lastName}: ${content.trim()}`,
          link: '/messages',
          time: new Date(),
        });
      }
    });

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// POST /api/messages/:conversationId/image — trimite imagine
router.post('/:conversationId/image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversatie negasita' });

    if (!conversation.participants.map(p => p.toString()).includes(req.user.id)) {
      return res.status(403).json({ message: 'Acces interzis' });
    }

    if (!req.file) return res.status(400).json({ message: 'Nicio imagine trimisa' });

    const message = await Message.create({
      conversation: req.params.conversationId,
      sender:       req.user.id,
      content:      '',
      type:         'image',
      imageUrl:     req.file.path,
    });

    conversation.lastMessage   = '📷 Imagine';
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populated = await message.populate('sender', 'firstName lastName avatar');

    const io = req.app.get('io');
    conversation.participants.forEach(participantId => {
      if (participantId.toString() !== req.user.id) {
        io.to(`user_${participantId}`).emit('new_message', {
          conversationId: req.params.conversationId,
          message:        populated,
        });

        io.to(`user_${participantId}`).emit('notification', {
          type: 'message',
          text: `${populated.sender.firstName} ${populated.sender.lastName}: 📷 Imagine`,
          link: '/messages',
          time: new Date(),
        });
      }
    });

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Eroare upload', error: err.message });
  }
});

// DELETE /api/messages/:conversationId — sterge conversatia
router.delete('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversatie negasita' });

    if (!conversation.participants.map(p => p.toString()).includes(req.user.id)) {
      return res.status(403).json({ message: 'Acces interzis' });
    }

    await Message.deleteMany({ conversation: req.params.conversationId });
    await Conversation.findByIdAndDelete(req.params.conversationId);

    res.json({ message: 'Conversatie stearsa' });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;