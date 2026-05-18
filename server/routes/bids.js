const router   = require('express').Router();
const Bid      = require('../models/Bid');
const authMiddleware = require('../middleware/auth');

// GET /api/bids/:auctionId — toate ofertele unei licitatii
router.get('/:auctionId', authMiddleware, async (req, res) => {
  try {
    const bids = await Bid.find({ auction: req.params.auctionId })
      .populate('supplier', 'firstName lastName companyName rating')
      .sort({ amount: 1 }); // crescator — cel mai mic primul

    res.json(bids);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// GET /api/bids/my — ofertele furnizorului logat
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const bids = await Bid.find({ supplier: req.user.id })
      .populate('auction', 'title currentPrice status')
      .sort({ createdAt: -1 });
    res.json(bids);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;