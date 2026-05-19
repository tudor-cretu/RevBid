const router         = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Subscription   = require('../models/Subscription');

// GET /api/subscriptions/check/:auctionId
router.get('/check/:auctionId', authMiddleware, async (req, res) => {
  try {
    const sub = await Subscription.findOne({
      user:    req.user.id,
      auction: req.params.auctionId,
    });
    res.json({ subscribed: !!sub });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server' });
  }
});

// POST /api/subscriptions/:auctionId — aboneaza
router.post('/:auctionId', authMiddleware, async (req, res) => {
  try {
    await Subscription.findOneAndUpdate(
      { user: req.user.id, auction: req.params.auctionId },
      { user: req.user.id, auction: req.params.auctionId },
      { upsert: true, new: true }
    );
    res.json({ subscribed: true });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server' });
  }
});

// DELETE /api/subscriptions/:auctionId — dezaboneaza
router.delete('/:auctionId', authMiddleware, async (req, res) => {
  try {
    await Subscription.deleteOne({
      user:    req.user.id,
      auction: req.params.auctionId,
    });
    res.json({ subscribed: false });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server' });
  }
});

module.exports = router;