const router     = require('express').Router();
const authMiddleware = require('../middleware/auth');
const sendMail   = require('../config/mailer');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { subject, message, email, name } = req.body;

    await sendMail({
      to:      process.env.EMAIL_USER,
      subject: `[RevBid Support] ${subject}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;padding:24px">
          <h3>Mesaj nou de support</h3>
          <p><strong>De la:</strong> ${name} (${email})</p>
          <p><strong>Subiect:</strong> ${subject}</p>
          <hr/>
          <p>${message.replace(/\n/g, '<br/>')}</p>
        </div>
      `,
    });

    // Confirmare catre user
    await sendMail({
      to:      email,
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
    res.status(500).json({ message: 'Eroare server', error: err.message });
  }
});

module.exports = router;