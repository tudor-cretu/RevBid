const router          = require('express').Router();
const Auction         = require('../models/Auction');
const authMiddleware  = require('../middleware/auth');
const Bid             = require('../models/Bid');
const Subscription    = require('../models/Subscription');
const AuctionChat     = require('../models/AuctionChat');

// GET /api/auctions — toate licitatiile (filtrate)
router.get('/', async (req, res) => {
  try {
    const { category, status } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status)   filter.status   = status;
    else          filter.status   = 'active';

    const auctions = await Auction.find(filter)
      .populate('buyer', 'firstName lastName companyName')
      .sort({ createdAt: -1 });

    res.json(auctions);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// GET /api/auctions/:id — detalii licitatie
router.get('/:id', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('buyer', 'firstName lastName companyName rating');

    if (!auction) return res.status(404).json({ message: 'Licitatia nu exista' });
    res.json(auction);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// POST /api/auctions — creaza licitatie (doar buyer)
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ message: 'Doar cumparatorii pot crea licitatii' });
    }

    const {
      title, description, category, tags,
      startPrice, targetPrice, deadline,
      autoExtend, location,
    } = req.body;

    const auction = await Auction.create({
      buyer: req.user.id,
      title, description, category,
      tags:        tags || [],
      startPrice,
      targetPrice: targetPrice || null,
      deadline:    deadline ? new Date(deadline) : null,
      autoExtend:  autoExtend || false,
      location:    location || {},
      status:      'active',
    });

    // Buyer se aboneaza automat la propria licitatie
    await Subscription.findOneAndUpdate(
      { user: req.user.id, auction: auction._id },
      { user: req.user.id, auction: auction._id },
      { upsert: true, new: true }
    );

    res.status(201).json(auction);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// PUT /api/auctions/:id — editeaza (doar buyer-ul propriu)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Licitatia nu exista' });

    if (auction.buyer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }
    if (auction.status === 'closed') {
      return res.status(400).json({ message: 'Licitatia e deja inchisa' });
    }

    const allowed = ['title', 'description', 'category', 'tags', 'targetPrice', 'deadline', 'autoExtend', 'location'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) auction[field] = req.body[field];
    });

    await auction.save();
    res.json(auction);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// DELETE /api/auctions/:id — anuleaza licitatie
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Licitatia nu exista' });

    if (auction.buyer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }

    auction.status = 'cancelled';
    await auction.save();
    res.json({ message: 'Licitatia a fost anulata' });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// GET /api/auctions/:id/chat — istoricul chat-ului
router.get('/:id/chat', authMiddleware, async (req, res) => {
  try {
    const messages = await AuctionChat.find({ auction: req.params.id })
      .populate('sender', 'firstName lastName avatar role')
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// POST /api/auctions/:id/chat — trimite mesaj in chat
router.post('/:id/chat', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Mesajul e gol' });

    const auction = await Auction.findById(req.params.id);
    if (!auction)                       return res.status(404).json({ message: 'Licitatia nu exista' });
    if (auction.status !== 'active')    return res.status(400).json({ message: 'Licitatia nu e activa' });

    const isBuyer = auction.buyer.toString() === req.user.id;
    const hasBid  = await Bid.exists({ auction: req.params.id, supplier: req.user.id });

    if (!isBuyer && !hasBid) {
      return res.status(403).json({
        message: 'Doar cumparatorul si furnizorii care au ofertat pot scrie aici',
      });
    }

    // Salveaza mesajul
    const message   = await AuctionChat.create({
      auction: req.params.id,
      sender:  req.user.id,
      content: content.trim(),
    });
    const populated = await message.populate('sender', 'firstName lastName avatar role');

    const io = req.app.get('io');

    // 1. Trimite mesajul in timp real tuturor celor din camera licitatiei
    //    (inclusiv alti useri care au pagina deschisa acum)
    //    Sender-ul primeste mesajul direct din raspunsul REST, nu via socket,
    //    asa ca emitem catre toti CEILALTI din room.
    io.to(req.params.id).emit('auction_chat', populated);

    // 2. Colecteaza destinatarii notificarilor (abonati + ofertanti + buyer)
    const [subscriptions, bids] = await Promise.all([
      Subscription.find({ auction: req.params.id }).select('user'),
      Bid.find({ auction: req.params.id }).distinct('supplier'),
    ]);

    const recipientIds = new Set([
      auction.buyer.toString(),
      ...subscriptions.map(s => s.user.toString()),
      ...bids.map(b => b.toString()),
    ]);

    // Nu notifica expeditorul
    recipientIds.delete(req.user.id);

    // 3. Trimite notificare in-app pentru fiecare destinatar
    const notifText = `${populated.sender.firstName} a scris in chat-ul licitatiei "${auction.title}"`;
    for (const userId of recipientIds) {
      io.to(`user_${userId}`).emit('notification', {
        type: 'auction_chat',
        text: notifText,
        link: `/auction/${req.params.id}`,
        time: new Date(),
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;