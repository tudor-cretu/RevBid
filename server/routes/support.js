'use strict';

const router         = require('express').Router();
const authMiddleware = require('../middleware/auth');
const sendMail       = require('../config/mailer');
const { supportLimiter } = require('../middleware/rateLimiters');
const logger        = require('../utils/logger');
const EVENTS        = require('../utils/events');

/* ── Escape HTML — previne XSS în emailurile generate ──────────
   User-input nu se interpolează niciodată direct în HTML; toate
   valorile trec prin escapeHtml() înainte de a fi inserate.       */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Sanitizare câmp text — trim + limit + escape pentru HTML. */
function cleanText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return escapeHtml(value.trim().slice(0, maxLen));
}

router.post('/', authMiddleware, supportLimiter, async (req, res) => {
  try {
    /* ── Validare + sanitizare ── */
    const subjectRaw = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
    const messageRaw = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const emailRaw   = typeof req.body.email   === 'string' ? req.body.email.trim()   : '';
    const nameRaw    = typeof req.body.name    === 'string' ? req.body.name.trim()    : '';

    if (!subjectRaw || subjectRaw.length < 3 || subjectRaw.length > 200) {
      return res.status(400).json({ message: 'Subiectul trebuie să aibă între 3 și 200 caractere' });
    }
    if (!messageRaw || messageRaw.length < 10 || messageRaw.length > 5000) {
      return res.status(400).json({ message: 'Mesajul trebuie să aibă între 10 și 5000 caractere' });
    }
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return res.status(400).json({ message: 'Email invalid' });
    }
    if (!nameRaw || nameRaw.length > 100) {
      return res.status(400).json({ message: 'Numele este obligatoriu (max 100 caractere)' });
    }

    /* Versiunile escapate sunt singurele inserate în HTML. */
    const subject = cleanText(subjectRaw, 200);
    const message = cleanText(messageRaw, 5000).replace(/\n/g, '<br/>');
    const email   = cleanText(emailRaw,   254);
    const name    = cleanText(nameRaw,    100);

    /* Header-ul Subject este controlat; eliminăm \r și \n pentru a
       preveni header injection în client-ul SMTP.                       */
    const safeSubjectHeader = subjectRaw.replace(/[\r\n]+/g, ' ').slice(0, 200);

    await sendMail({
      to:      process.env.EMAIL_USER,
      subject: `[RevBid Support] ${safeSubjectHeader}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;padding:24px">
          <h3>Mesaj nou de support</h3>
          <p><strong>De la:</strong> ${name} (${email})</p>
          <p><strong>Subiect:</strong> ${subject}</p>
          <hr/>
          <p>${message}</p>
        </div>
      `,
    });

    /* Confirmare către user */
    await sendMail({
      to:      emailRaw,
      subject: 'RevBid — Am primit mesajul tau',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;padding:24px">
          <h3>Multumim pentru mesaj!</h3>
          <p>Salut <strong>${name}</strong>,</p>
          <p>Am primit mesajul tau cu subiectul "<strong>${subject}</strong>" si te vom contacta in maxim 24 ore.</p>
          <p style="font-size:12px;color:#999">RevBid — Platforma de licitatii inverse</p>
        </div>
      `,
    });

    res.json({ message: 'Mesaj trimis' });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server' });
  }
});

module.exports = router;
