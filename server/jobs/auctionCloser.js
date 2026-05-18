const cron    = require('node-cron');
const Auction = require('../models/Auction');
const Bid     = require('../models/Bid');
const User    = require('../models/User');
const sendMail = require('../config/mailer');
const { auctionWonTemplate, deadlineSoonTemplate } = require('../config/emailTemplates');

module.exports = (io) => {

  // Ruleaza la fiecare minut
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    // ── 1. Inchide licitatiile expirate ──────────────────────────────
    const expired = await Auction.find({
      status:   'active',
      deadline: { $lte: now },
    });

    for (const auction of expired) {
      auction.status = 'closed';
      await auction.save();

      console.log(`Licitatie inchisa: ${auction.title}`);

      // Gaseste oferta castigatoare
      const winningBid = await Bid.findOne({
        auction:   auction._id,
        isWinning: true,
      }).populate('supplier', 'firstName email');

      // Notifica furnizorul castigator
      if (winningBid?.supplier?.email) {
        const { subject, html } = auctionWonTemplate({
          firstName:    winningBid.supplier.firstName,
          auctionTitle: auction.title,
          finalPrice:   winningBid.amount,
          auctionId:    auction._id,
        });
        sendMail({ to: winningBid.supplier.email, subject, html });
      }

      // Notifica buyer-ul ca licitatia s-a incheiat
      const buyer = await User.findById(auction.buyer);
      if (buyer?.email) {
        sendMail({
          to:      buyer.email,
          subject: `RevBid — Licitatia "${auction.title}" s-a incheiat`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
              <h2>Licitatia s-a incheiat</h2>
              <p>Salut <strong>${buyer.firstName}</strong>,</p>
              <p>Licitatia <strong>"${auction.title}"</strong> s-a incheiat.</p>
              ${winningBid
                ? `<p>Pret final: <strong>${winningBid.amount} RON</strong></p>`
                : `<p>Nu au fost depuse oferte.</p>`
              }
              <a href="${process.env.CLIENT_URL}/auction/${auction._id}"
                 style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none">
                Vezi detalii
              </a>
              <p style="margin-top:24px;font-size:12px;color:#999">RevBid — Platforma de licitatii inverse</p>
            </div>
          `,
        });
      }

      // Emite event Socket.IO catre camera licitatiei
      io.to(auction._id.toString()).emit('auction_closed', {
        auctionId:   auction._id,
        finalPrice:  winningBid?.amount || null,
        winnerId:    winningBid?.supplier?._id || null,
      });
    }

    // ── 2. Alertă deadline aproape (cu 1 ora inainte) ─────────────────
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const twoMinBuffer   = new Date(now.getTime() + 62 * 60 * 1000);

    const soonAuctions = await Auction.find({
      status:   'active',
      deadline: { $gte: oneHourFromNow, $lte: twoMinBuffer },
    });

    for (const auction of soonAuctions) {
      // Gaseste toti furnizorii care au ofertat
      const bids = await Bid.find({ auction: auction._id })
        .populate('supplier', 'firstName email');

      const uniqueSuppliers = [];
      const seen = new Set();
      for (const bid of bids) {
        if (bid.supplier && !seen.has(bid.supplier._id.toString())) {
          seen.add(bid.supplier._id.toString());
          uniqueSuppliers.push(bid.supplier);
        }
      }

      for (const supplier of uniqueSuppliers) {
        const { subject, html } = deadlineSoonTemplate({
          firstName:    supplier.firstName,
          auctionTitle: auction.title,
          minutesLeft:  60,
          auctionId:    auction._id,
        });
        sendMail({ to: supplier.email, subject, html });
      }
    }
  });

  console.log('Job auto-close pornit');
};