const router       = require('express').Router();
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const User         = require('../models/User');
const sendMail     = require('../config/mailer');
const authMiddleware = require('../middleware/auth');
const passport     = require('../config/passport');

const generateToken = (user) => jwt.sign(
  { id: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

const userPayload = (user) => ({
  id:          user._id,
  firstName:   user.firstName,
  lastName:    user.lastName,
  email:       user.email,
  role:        user.role,
  isVerified:  user.isVerified,
  avatar:      user.avatar,
  companyName: user.companyName,
});

// ── REGISTER ────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, companyName, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email deja inregistrat' });

    const passwordHash = await bcrypt.hash(password, 10);

    // Genereaza cod verificare 6 cifre
    const verifyCode       = Math.floor(100000 + Math.random() * 900000).toString();
    const verifyCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minute

    const user = await User.create({
      firstName, lastName, email, passwordHash,
      role:        role || 'buyer',
      companyName: companyName || '',
      phone:       phone || '',
      isVerified:  false,
      verifyCode,
      verifyCodeExpiry,
    });

    // Trimite email cu codul
    await sendMail({
      to:      email,
      subject: 'RevBid — Cod de verificare',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px">
          <h2>Verifica-ti contul RevBid</h2>
          <p>Salut <strong>${firstName}</strong>,</p>
          <p>Introdu codul de mai jos pentru a-ti activa contul:</p>
          <div style="text-align:center;margin:24px 0">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a">
              ${verifyCode}
            </span>
          </div>
          <p style="color:#718096;font-size:13px">Codul expira in 15 minute.</p>
        </div>
      `,
    });

    res.status(201).json({
      message:    'Cont creat. Verifica emailul pentru cod.',
      needsVerify: true,
      email,
    });

  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// ── VERIFY EMAIL ─────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User negasit' });
    if (user.isVerified) return res.status(400).json({ message: 'Cont deja verificat' });

    if (user.verifyCode !== code) {
      return res.status(400).json({ message: 'Cod incorect' });
    }

    if (new Date() > user.verifyCodeExpiry) {
      return res.status(400).json({ message: 'Codul a expirat. Solicita unul nou.' });
    }

    user.isVerified        = true;
    user.verifyCode        = null;
    user.verifyCodeExpiry  = null;
    await user.save();

    const token = generateToken(user);
    res.json({ token, user: userPayload(user) });

  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// ── RESEND CODE ───────────────────────────────────────────────────
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User negasit' });
    if (user.isVerified) return res.status(400).json({ message: 'Cont deja verificat' });

    const verifyCode       = Math.floor(100000 + Math.random() * 900000).toString();
    const verifyCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.verifyCode       = verifyCode;
    user.verifyCodeExpiry = verifyCodeExpiry;
    await user.save();

    await sendMail({
      to:      email,
      subject: 'RevBid — Cod nou de verificare',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px">
          <h2>Cod nou de verificare</h2>
          <div style="text-align:center;margin:24px 0">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a">
              ${verifyCode}
            </span>
          </div>
          <p style="color:#718096;font-size:13px">Codul expira in 15 minute.</p>
        </div>
      `,
    });

    res.json({ message: 'Cod nou trimis' });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// ── LOGIN ────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email sau parola incorecta' });
    if (user.isBanned) return res.status(403).json({ message: 'Cont suspendat' });

    // User Google fara parola
    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Acest cont foloseste autentificarea Google' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Email sau parola incorecta' });

    // DEZACTIVAT TEMPORAR PENTRU TESTARE
    // if (!user.isVerified) {
    //   return res.status(403).json({
    //     message:     'Cont neverificat. Verifica emailul.',
    //     needsVerify: true,
    //     email,
    //   });
    // }

    const token = generateToken(user);
    res.json({ token, user: userPayload(user) });

  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// ── GOOGLE OAUTH ──────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login?error=google` }),
  async (req, res) => {
    const token = generateToken(req.user);
    // Redirecteaza catre frontend cu tokenul in URL
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

// ── ME ────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash -verifyCode -verifyCodeExpiry');
  res.json(user);
});

// PUT /api/auth/settings — actualizeaza profilul
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, phone, companyName, city } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone, companyName, city },
      { new: true }
    ).select('-passwordHash -verifyCode -verifyCodeExpiry');

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Contul tau foloseste autentificarea Google' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Parola curenta incorecta' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Parola schimbata cu succes' });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// DELETE /api/auth/account — sterge contul
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    res.json({ message: 'Cont sters' });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// PUT /api/auth/avatar — upload poza profil
router.put('/avatar', authMiddleware, async (req, res) => {
  try {
    const { upload, cloudinary } = require('../config/cloudinary');

    upload.single('avatar')(req, res, async (err) => {
      if (err) return res.status(400).json({ message: 'Eroare upload' });
      if (!req.file) return res.status(400).json({ message: 'Nicio imagine trimisa' });

      // Sterge avatarul vechi de pe Cloudinary daca exista
      const user = await User.findById(req.user.id);
      if (user.avatarPublicId) {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { avatar: req.file.path, avatarPublicId: req.file.filename },
        { new: true }
      ).select('-passwordHash -verifyCode -verifyCodeExpiry');

      res.json(updatedUser);
    });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// GET /api/auth/profile/:id — profil public
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('firstName lastName companyName role avatar city rating reviewCount createdAt');
    if (!user) return res.status(404).json({ message: 'Userul nu exista' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

// GET /api/auth/profile/:id/stats
router.get('/profile/:id/stats', async (req, res) => {
  try {
    const Auction = require('../models/Auction');
    const Bid     = require('../models/Bid');

    const [auctionsCount, bidsCount, wonCount] = await Promise.all([
      Auction.countDocuments({ buyer: req.params.id }),
      Bid.countDocuments({ supplier: req.params.id }),
      Bid.countDocuments({ supplier: req.params.id, isWinning: true }),
    ]);

    res.json({ auctionsCount, bidsCount, wonCount });
  } catch (err) {
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;