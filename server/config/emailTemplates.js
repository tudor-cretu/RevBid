const outbidTemplate = ({ firstName, auctionTitle, newPrice, auctionId }) => ({
  subject: `RevBid — Ai fost supralicitat la "${auctionTitle}"`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a">Ai fost supralicitat!</h2>
      <p>Salut <strong>${firstName}</strong>,</p>
      <p>Cineva a depus o ofertă mai mică la licitația
        <strong>"${auctionTitle}"</strong>.
      </p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
        <p style="margin:0;color:#666;font-size:14px">Preț curent</p>
        <p style="margin:4px 0;font-size:28px;font-weight:bold;color:#e53e3e">${newPrice} RON</p>
      </div>
      <a href="${process.env.CLIENT_URL}/auction/${auctionId}"
         style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none">
        Liciteaza acum
      </a>
      <p style="margin-top:24px;font-size:12px;color:#999">RevBid — Platforma de licitatii inverse</p>
    </div>
  `,
});

const auctionWonTemplate = ({ firstName, auctionTitle, finalPrice, auctionId }) => ({
  subject: `RevBid — Ai castigat licitatia "${auctionTitle}"!`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a">Felicitari, ai castigat! 🎉</h2>
      <p>Salut <strong>${firstName}</strong>,</p>
      <p>Oferta ta a fost cea mai buna la licitatia
        <strong>"${auctionTitle}"</strong>.
      </p>
      <div style="background:#f0fff4;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
        <p style="margin:0;color:#666;font-size:14px">Pret final</p>
        <p style="margin:4px 0;font-size:28px;font-weight:bold;color:#38a169">${finalPrice} RON</p>
      </div>
      <a href="${process.env.CLIENT_URL}/auction/${auctionId}"
         style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none">
        Vezi detalii
      </a>
      <p style="margin-top:24px;font-size:12px;color:#999">RevBid — Platforma de licitatii inverse</p>
    </div>
  `,
});

const deadlineSoonTemplate = ({ firstName, auctionTitle, minutesLeft, auctionId }) => ({
  subject: `RevBid — Licitatia "${auctionTitle}" se incheie in ${minutesLeft} minute`,
  html: `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a">⏰ Timp limitat!</h2>
      <p>Salut <strong>${firstName}</strong>,</p>
      <p>Licitatia <strong>"${auctionTitle}"</strong> la care participi
         se incheie in <strong>${minutesLeft} minute</strong>.
      </p>
      <a href="${process.env.CLIENT_URL}/auction/${auctionId}"
         style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none">
        Vezi licitatia
      </a>
      <p style="margin-top:24px;font-size:12px;color:#999">RevBid — Platforma de licitatii inverse</p>
    </div>
  `,
});

module.exports = { outbidTemplate, auctionWonTemplate, deadlineSoonTemplate };