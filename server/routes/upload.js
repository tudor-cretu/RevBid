'use strict';

const router           = require('express').Router();
const authMiddleware   = require('../middleware/auth');
const { cloudinary, upload } = require('../config/cloudinary');
const Auction          = require('../models/Auction');
const logger           = require('../utils/logger');
const EVENTS           = require('../utils/events');

/* ── POST /api/upload/auction/:id ───────────────────────────── */
router.post('/auction/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      logger.fromReq(req).warn(EVENTS.UPLOAD.FAILED,
        'Upload imagini — licitație inexistentă', {
          entityType: 'auction',
          entityId:   req.params.id,
        });
      return res.status(404).json({ message: 'Licitatia nu exista' });
    }

    if (auction.buyer.toString() !== req.user.id) {
      logger.fromReq(req).security(EVENTS.UPLOAD.UNAUTHORIZED,
        'Upload imagini — utilizator fără permisiune', {
          entityType: 'auction',
          entityId:   req.params.id,
          metadata:   { ownerId: auction.buyer.toString() },
        });
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }

    if (!req.files || req.files.length === 0) {
      logger.fromReq(req).warn(EVENTS.UPLOAD.NO_FILES,
        'Upload fără fișiere atașate', {
          entityType: 'auction',
          entityId:   req.params.id,
        });
      return res.status(400).json({ message: 'Nicio imagine trimisa' });
    }

    const newImages = req.files.map((file, index) => ({
      url:      file.path,
      publicId: file.filename,
      order:    auction.images.length + index,
    }));

    auction.images.push(...newImages);
    await auction.save();

    logger.fromReq(req).audit(EVENTS.UPLOAD.SUCCESS,
      `${req.files.length} imagine(i) încărcate pentru licitația "${auction.title}"`, {
        entityType: 'auction',
        entityId:   auction._id.toString(),
        metadata: {
          count:    req.files.length,
          total:    auction.images.length,
          filenames: req.files.map(f => f.filename),
        },
      });

    res.json({
      message: `${req.files.length} imagine(i) incarcate`,
      images:  auction.images,
    });

  } catch (err) {
    logger.logReqError(req, EVENTS.UPLOAD.FAILED, err, {
      entityType: 'auction',
      entityId:   req.params.id,
    });
    res.status(500).json({ message: 'Eroare upload', error: err.message });
  }
});

/* ── DELETE /api/upload/image/:auctionId/:publicId ──────────── */
router.delete('/image/:auctionId/:publicId', authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.auctionId);
    if (!auction) return res.status(404).json({ message: 'Licitatia nu exista' });

    if (auction.buyer.toString() !== req.user.id) {
      logger.fromReq(req).security(EVENTS.UPLOAD.UNAUTHORIZED,
        'Ștergere imagine — utilizator fără permisiune', {
          entityType: 'auction',
          entityId:   req.params.auctionId,
          metadata:   { ownerId: auction.buyer.toString() },
        });
      return res.status(403).json({ message: 'Nu ai permisiune' });
    }

    const publicId = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(publicId);

    auction.images = auction.images.filter(img => img.publicId !== publicId);
    await auction.save();

    logger.fromReq(req).audit(EVENTS.UPLOAD.IMAGE_DELETED,
      `Imagine ștearsă din licitația "${auction.title}"`, {
        entityType: 'auction',
        entityId:   auction._id.toString(),
        metadata:   { publicId, remainingImages: auction.images.length },
      });

    res.json({ message: 'Imaginea a fost stearsa', images: auction.images });

  } catch (err) {
    logger.logReqError(req, EVENTS.UPLOAD.DELETE_FAILED, err, {
      entityType: 'auction',
      entityId:   req.params.auctionId,
    });
    res.status(500).json({ message: 'Eroare stergere', error: err.message });
  }
});

module.exports = router;
