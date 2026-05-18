const router           = require('express').Router();
const authMiddleware   = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');
const Auction          = require('../models/Auction');

// POST /api/upload/auction/:id  — max 5 poze per licitatie
router.post('/auction/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Licitatia nu exista' });

    if (auction.buyer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Nicio imagine trimisa' });
    }

    const newImages = req.files.map((file, index) => ({
      url:      file.path,
      publicId: file.filename,
      order:    auction.images.length + index,
    }));

    auction.images.push(...newImages);
    await auction.save();

    res.json({
      message: `${req.files.length} imagine(i) incarcate`,
      images:  auction.images,
    });

  } catch (err) {
    res.status(500).json({ message: 'Eroare upload', error: err.message });
  }
});

// DELETE /api/upload/image/:auctionId/:publicId — sterge o imagine
router.delete('/image/:auctionId/:publicId', authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.auctionId);
    if (!auction) return res.status(404).json({ message: 'Licitatia nu exista' });

    if (auction.buyer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }

    const publicId = decodeURIComponent(req.params.publicId);

    await cloudinary.uploader.destroy(publicId);

    auction.images = auction.images.filter(img => img.publicId !== publicId);
    await auction.save();

    res.json({ message: 'Imaginea a fost stearsa', images: auction.images });

  } catch (err) {
    res.status(500).json({ message: 'Eroare stergere', error: err.message });
  }
});

module.exports = router;