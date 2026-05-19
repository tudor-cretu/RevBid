const router         = require('express').Router();
const authMiddleware = require('../middleware/auth');
const Notification   = require('../models/Notification');

// GET /api/notifications — ultimele 50 notificari ale userului
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// PUT /api/notifications/read — marcheaza toate ca citite
router.put('/read', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// DELETE /api/notifications — sterge toate notificarile userului
router.delete('/', authMiddleware, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
