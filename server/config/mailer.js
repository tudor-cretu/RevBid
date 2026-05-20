const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Trimite un email.
 * @returns {Promise<boolean>} true dacă a fost trimis cu succes, false la eroare.
 */
const sendMail = async ({ to, subject, html }) => {
  if (!to) return false;
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`Email trimis catre ${to}`);
    return true;
  } catch (err) {
    console.error('Eroare email:', err.message);
    return false;
  }
};

module.exports = sendMail;