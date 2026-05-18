const router         = require('express').Router();
const User           = require('../models/User');
const Auction        = require('../models/Auction');
const authMiddleware = require('../middleware/auth');

// Middleware — doar admin
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acces interzis' });
  }
  next();
};

// GET /api/admin/users
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// PUT /api/admin/users/:id/ban
router.put('/users/:id/ban', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: req.body.isBanned },
      { new: true }
    ).select('-passwordHash');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// GET /api/admin/auctions
router.get('/auctions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const auctions = await Auction.find()
      .populate('buyer', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// PUT /api/admin/auctions/:id/close
router.put('/auctions/:id/close', authMiddleware, adminOnly, async (req, res) => {
  try {
    const auction = await Auction.findByIdAndUpdate(
      req.params.id,
      { status: 'closed' },
      { new: true }
    );
    res.json(auction);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;