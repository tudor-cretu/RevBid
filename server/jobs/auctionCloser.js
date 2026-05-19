'use strict';

const cron     = require('node-cron');
const Auction  = require('../models/Auction');
const Bid      = require('../models/Bid');
const User     = require('../models/User');
const sendMail = require('../config/mailer');
const { auctionWonTemplate, deadlineSoonTemplate } = require('../config/emailTemplates');
const logger   = require('../utils/logger');
const EVENTS   = require('../utils/events');

module.exports = (io) => {

  /* Rulează la fiecare minut */
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    /* ── 1. Închide licitațiile expirate ───────────────────────── */
    try {
      const expired = await Auction.find({
        status:   'active',
        deadline: { $lte: now },
      });

      for (const auction of expired) {
        auction.status = 'closed';
        await auction.save();

        logger.audit(EVENTS.AUCTION.CLOSED_AUTO,
          `Licitație închisă automat: "${auction.title}"`, {
            entityType: 'auction',
            entityId:   auction._id.toString(),
            metadata:   { deadline: auction.deadline, closedAt: now },
          });

        const winningBid = await Bid.findOne({
          auction:   auction._id,
          isWinning: true,
        }).populate('supplier', 'firstName email');

        if (winningBid?.supplier?.email) {
          const { subject, html } = auctionWonTemplate({
            firstName:    winningBid.supplier.firstName,
            auctionTitle: auction.title,
            finalPrice:   winningBid.amount,
            auctionId:    auction._id,
          });
          sendMail({ to: winningBid.supplier.email, subject, html });

          logger.info(EVENTS.BID.WINNING,
            `Email câștigător trimis: "${auction.title}" → ${winningBid.amount} RON`, {
              entityType: 'auction',
              entityId:   auction._id.toString(),
              metadata:   { supplierId: winningBid.supplier._id, finalPrice: winningBid.amount },
            });
        }

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
              </div>
            `,
          });
        }

        io.to(auction._id.toString()).emit('auction_closed', {
          auctionId:  auction._id,
          finalPrice: winningBid?.amount || null,
          winnerId:   winningBid?.supplier?._id || null,
        });
      }

      if (expired.length > 0) {
        logger.info(EVENTS.AUCTION.CLOSED_AUTO,
          `Job auto-close: ${expired.length} licitație(i) închisă(e)`, {
            metadata: { count: expired.length, at: now },
          });
      }

    } catch (err) {
      logger.error(EVENTS.SYSTEM.UNHANDLED_ERROR,
        `Eroare în job auto-close: ${err.message}`, {
          errorName:    err.name,
          errorMessage: err.message,
          stack:        err.stack,
        });
    }

    /* ── 2. Alertă deadline aproape (cu 1 oră înainte) ─────────── */
    try {
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const twoMinBuffer   = new Date(now.getTime() + 62 * 60 * 1000);

      const soonAuctions = await Auction.find({
        status:   'active',
        deadline: { $gte: oneHourFromNow, $lte: twoMinBuffer },
      });

      for (const auction of soonAuctions) {
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

        if (uniqueSuppliers.length > 0) {
          logger.info(EVENTS.AUCTION.FETCH,
            `Alerte deadline trimise pentru "${auction.title}" (${uniqueSuppliers.length} furnizori)`, {
              entityType: 'auction',
              entityId:   auction._id.toString(),
              metadata:   { suppliersNotified: uniqueSuppliers.length },
            });
        }
      }

    } catch (err) {
      logger.error(EVENTS.SYSTEM.UNHANDLED_ERROR,
        `Eroare în job deadline-alert: ${err.message}`, {
          errorName:    err.name,
          errorMessage: err.message,
          stack:        err.stack,
        });
    }
  });

  logger.info(EVENTS.SYSTEM.JOB_STARTED,
    'Job auto-close licitații pornit', {
      metadata: { schedule: '* * * * *' },
    });
};
