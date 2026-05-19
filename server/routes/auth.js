'use strict';

const router         = require('express').Router();
const bcrypt         = require('bcryptjs');
const jwt            = require('jsonwebtoken');
const crypto         = require('crypto');
const User           = require('../models/User');
const sendMail       = require('../config/mailer');
const authMiddleware = require('../middleware/auth');
const passport       = require('../config/passport');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');
const { maskEmail }  = require('../utils/sanitize');

/* ── Helpers ─────────────────────────────────────────────────── */
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

/* ── Rate limiting simplu pentru login (în memorie) ─────────── */
/* Pentru producție folosiți Redis + express-rate-limit          */
const loginAttempts = new Map(); // key: email → { count, resetAt }
const MAX_ATTEMPTS  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minute

function checkRateLimit(email) {
  const now  = Date.now();
  const data = loginAttempts.get(email);

  if (!data || now > data.resetAt) {
    loginAttempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
    return { blocked: false, count: 1 };
  }

  data.count += 1;
  if (data.count > MAX_ATTEMPTS) {
    return { blocked: true, count: data.count };
  }
  return { blocked: false, count: data.count };
}

function resetAttempts(email) {
  loginAttempts.delete(email);
}

/* ── REGISTER ────────────────────────────────────────────────── */
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, companyName, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      logger.fromReq(req).warn(EVENTS.AUTH.REGISTER_FAILED,
        'Tentativă de înregistrare cu email existent', {
          metadata: { email: maskEmail(email) },
        });
      return res.status(400).json({ message: 'Email deja inregistrat' });
    }

    const passwordHash     = await bcrypt.hash(password, 10);
    const verifyCode       = Math.floor(100000 + Math.random() * 900000).toString();
    const verifyCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const user = await User.create({
      firstName, lastName, email, passwordHash,
      role:        role || 'buyer',
      companyName: companyName || '',
      phone:       phone || '',
      isVerified:  false,
      verifyCode,
      verifyCodeExpiry,
    });

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

    logger.fromReq(req).audit(EVENTS.AUTH.REGISTER_SUCCESS,
      'Utilizator nou înregistrat', {
        entityType: 'user',
        entityId:   user._id.toString(),
        metadata:   { email: maskEmail(email), role: user.role },
      });

    res.status(201).json({
      message:     'Cont creat. Verifica emailul pentru cod.',
      needsVerify: true,
      email,
    });

  } catch (err) {
    logger.logReqError(req, EVENTS.AUTH.REGISTER_FAILED, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── VERIFY EMAIL ────────────────────────────────────────────── */
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User negasit' });
    if (user.isVerified) return res.status(400).json({ message: 'Cont deja verificat' });

    if (user.verifyCode !== code) {
      logger.fromReq(req).security(EVENTS.AUTH.EMAIL_VERIFY_FAILED,
        'Cod de verificare incorect', {
          entityType: 'user',
          entityId:   user._id.toString(),
          metadata:   { email: maskEmail(email) },
        });
      return res.status(400).json({ message: 'Cod incorect' });
    }

    if (new Date() > user.verifyCodeExpiry) {
      logger.fromReq(req).warn(EVENTS.AUTH.EMAIL_VERIFY_FAILED,
        'Cod de verificare expirat', {
          entityType: 'user',
          entityId:   user._id.toString(),
          metadata:   { email: maskEmail(email) },
        });
      return res.status(400).json({ message: 'Codul a expirat. Solicita unul nou.' });
    }

    user.isVerified       = true;
    user.verifyCode        = null;
    user.verifyCodeExpiry  = null;
    await user.save();

    logger.fromReq(req).audit(EVENTS.AUTH.EMAIL_VERIFY_SUCCESS,
      'Email verificat cu succes', {
        entityType: 'user',
        entityId:   user._id.toString(),
        metadata:   { email: maskEmail(email) },
      });

    const token = generateToken(user);
    res.json({ token, user: userPayload(user) });

  } catch (err) {
    logger.logReqError(req, EVENTS.AUTH.EMAIL_VERIFY_FAILED, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── RESEND CODE ─────────────────────────────────────────────── */
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

    logger.fromReq(req).info(EVENTS.AUTH.RESEND_CODE,
      'Cod de verificare retrimis', {
        entityType: 'user',
        entityId:   user._id.toString(),
        metadata:   { email: maskEmail(email) },
      });

    res.json({ message: 'Cod nou trimis' });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── LOGIN ───────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    /* Rate limiting */
    const rateCheck = checkRateLimit(email);
    if (rateCheck.blocked) {
      logger.fromReq(req).security(EVENTS.AUTH.LOGIN_FAILED,
        'Prea multe încercări de login — cont blocat temporar', {
          metadata: { email: maskEmail(email), attempts: rateCheck.count },
        });
      return res.status(429).json({
        message: `Prea multe încercări. Încearcă din nou după ${Math.ceil(WINDOW_MS / 60000)} minute.`,
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      logger.fromReq(req).security(EVENTS.AUTH.LOGIN_FAILED,
        'Login eșuat — email inexistent', {
          metadata: { email: maskEmail(email), attempt: rateCheck.count },
        });
      return res.status(400).json({ message: 'Email sau parola incorecta' });
    }

    if (user.isBanned) {
      logger.fromReq(req).security(EVENTS.AUTH.LOGIN_BANNED,
        'Tentativă de login cu cont suspendat', {
          entityType: 'user',
          entityId:   user._id.toString(),
          metadata:   { email: maskEmail(email) },
        });
      return res.status(403).json({ message: 'Cont suspendat' });
    }

    if (!user.passwordHash) {
      logger.fromReq(req).warn(EVENTS.AUTH.LOGIN_FAILED,
        'Login cu parolă pe cont Google', {
          entityType: 'user',
          entityId:   user._id.toString(),
          metadata:   { email: maskEmail(email) },
        });
      return res.status(400).json({ message: 'Acest cont foloseste autentificarea Google' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      logger.fromReq(req).security(EVENTS.AUTH.LOGIN_FAILED,
        'Login eșuat — parolă incorectă', {
          entityType: 'user',
          entityId:   user._id.toString(),
          metadata:   { email: maskEmail(email), attempt: rateCheck.count },
        });
      return res.status(400).json({ message: 'Email sau parola incorecta' });
    }

    /* Login reușit — resetăm rate limiter */
    resetAttempts(email);

    logger.fromReq(req).audit(EVENTS.AUTH.LOGIN_SUCCESS,
      'Login reușit', {
        entityType: 'user',
        entityId:   user._id.toString(),
        metadata:   { email: maskEmail(email), role: user.role },
      });

    const token = generateToken(user);
    res.json({ token, user: userPayload(user) });

  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── GOOGLE OAUTH ────────────────────────────────────────────── */
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL}/login?error=google` }),
  async (req, res) => {
    logger.fromReq(req).audit(EVENTS.AUTH.GOOGLE_LOGIN,
      'Login Google OAuth reușit', {
        entityType: 'user',
        entityId:   req.user?._id?.toString(),
        metadata:   { email: maskEmail(req.user?.email), role: req.user?.role },
      });
    const token = generateToken(req.user);
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

/* ── ME ──────────────────────────────────────────────────────── */
router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash -verifyCode -verifyCodeExpiry');
  res.json(user);
});

/* ── SETTINGS — actualizează profil ─────────────────────────── */
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, phone, companyName, city } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone, companyName, city },
      { new: true }
    ).select('-passwordHash -verifyCode -verifyCodeExpiry');

    logger.fromReq(req).audit(EVENTS.AUTH.PROFILE_UPDATED,
      'Profil actualizat', {
        entityType: 'user',
        entityId:   req.user.id,
        metadata:   { fields: ['firstName', 'lastName', 'phone', 'companyName', 'city'] },
      });

    res.json(user);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── CHANGE PASSWORD ─────────────────────────────────────────── */
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.passwordHash) {
      logger.fromReq(req).warn(EVENTS.AUTH.PASSWORD_CHANGE_FAILED,
        'Schimbare parolă pe cont Google', {
          entityType: 'user', entityId: req.user.id,
        });
      return res.status(400).json({ message: 'Contul tau foloseste autentificarea Google' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      logger.fromReq(req).security(EVENTS.AUTH.PASSWORD_CHANGE_FAILED,
        'Parolă curentă incorectă la schimbare parolă', {
          entityType: 'user', entityId: req.user.id,
        });
      return res.status(400).json({ message: 'Parola curenta incorecta' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    logger.fromReq(req).audit(EVENTS.AUTH.PASSWORD_CHANGED,
      'Parolă schimbată cu succes', {
        entityType: 'user', entityId: req.user.id,
      });

    res.json({ message: 'Parola schimbata cu succes' });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── DELETE ACCOUNT ──────────────────────────────────────────── */
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);

    logger.fromReq(req).audit(EVENTS.AUTH.ACCOUNT_DELETED,
      'Cont șters de utilizator', {
        entityType: 'user',
        entityId:   req.user.id,
        metadata:   { role: req.user.role },
      });

    res.json({ message: 'Cont sters' });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── AVATAR ──────────────────────────────────────────────────── */
router.put('/avatar', authMiddleware, async (req, res) => {
  try {
    const { upload, cloudinary } = require('../config/cloudinary');

    upload.single('avatar')(req, res, async (err) => {
      if (err) {
        logger.fromReq(req).warn(EVENTS.UPLOAD.FAILED,
          'Eroare upload avatar', {
            entityType: 'user',
            entityId:   req.user.id,
            metadata:   { error: err.message },
          });
        return res.status(400).json({ message: 'Eroare upload' });
      }
      if (!req.file) {
        return res.status(400).json({ message: 'Nicio imagine trimisa' });
      }

      const user = await User.findById(req.user.id);
      if (user.avatarPublicId) {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { avatar: req.file.path, avatarPublicId: req.file.filename },
        { new: true }
      ).select('-passwordHash -verifyCode -verifyCodeExpiry');

      logger.fromReq(req).audit(EVENTS.AUTH.AVATAR_UPDATED,
        'Avatar actualizat', {
          entityType: 'user',
          entityId:   req.user.id,
          metadata:   { filename: req.file.filename },
        });

      res.json(updatedUser);
    });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PROFILE PUBLIC ──────────────────────────────────────────── */
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('firstName lastName companyName role avatar city rating reviewCount createdAt');
    if (!user) return res.status(404).json({ message: 'Userul nu exista' });
    res.json(user);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

/* ── PROFILE STATS ───────────────────────────────────────────── */
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
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;
