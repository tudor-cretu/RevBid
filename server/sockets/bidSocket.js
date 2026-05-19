'use strict';

const jwt          = require('jsonwebtoken');
const Auction      = require('../models/Auction');
const Bid          = require('../models/Bid');
const Subscription = require('../models/Subscription');
const User         = require('../models/User');
const sendMail     = require('../config/mailer');
const { outbidTemplate } = require('../config/emailTemplates');
const logger       = require('../utils/logger');
const EVENTS       = require('../utils/events');

module.exports = (io) => {

  /* ── Socket auth middleware ─────────────────────────────────── */
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      logger.security(EVENTS.SOCKET.AUTH_FAILED,
        'Conexiune Socket.IO refuzată — token lipsă', {
          metadata: { ip: socket.handshake.address },
        });
      return next(new Error('Token lipsa'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user   = decoded;
      next();
    } catch (err) {
      logger.security(EVENTS.SOCKET.AUTH_FAILED,
        `Conexiune Socket.IO refuzată — token invalid: ${err.message}`, {
          metadata: { ip: socket.handshake.address, error: err.name },
        });
      next(new Error('Token invalid'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(EVENTS.SOCKET.CONNECTED,
      `User conectat via Socket.IO`, {
        userId:   socket.user.id,
        userRole: socket.user.role,
        metadata: { ip: socket.handshake.address },
      });

    /* Fiecare user intră în propriul room pentru notificări personale */
    socket.join(`user_${socket.user.id}`);

    /* ── Intră în camera licitației ──────────────────────────── */
    socket.on('join_auction', (auctionId) => {
      socket.join(auctionId);
      logger.debug(EVENTS.SOCKET.JOIN_AUCTION,
        `User a intrat în camera licitației ${auctionId}`, {
          userId:   socket.user.id,
          userRole: socket.user.role,
          entityType: 'auction',
          entityId:   auctionId,
        });
    });

    socket.on('leave_auction', (auctionId) => {
      socket.leave(auctionId);
      logger.debug(EVENTS.SOCKET.LEAVE_AUCTION,
        `User a ieșit din camera licitației ${auctionId}`, {
          userId:   socket.user.id,
          entityType: 'auction',
          entityId:   auctionId,
        });
    });

    /* ── Depune ofertă ──────────────────────────────────────── */
    socket.on('place_bid', async (data, callback) => {
      try {
        const { auctionId, amount, message } = data;

        /* ── Validări ── */
        const auction = await Auction.findById(auctionId);
        if (!auction) {
          logger.warn(EVENTS.BID.REJECTED, 'Ofertă pe licitație inexistentă', {
            userId: socket.user.id, entityId: auctionId,
          });
          return callback({ error: 'Licitatia nu exista' });
        }

        if (auction.status !== 'active') {
          logger.warn(EVENTS.BID.REJECTED, 'Ofertă pe licitație inactivă', {
            userId: socket.user.id, entityType: 'auction', entityId: auctionId,
            metadata: { status: auction.status },
          });
          return callback({ error: 'Licitatia nu e activa' });
        }

        if (socket.user.role !== 'supplier') {
          logger.security(EVENTS.BID.UNAUTHORIZED,
            'Non-furnizor a încercat să depună ofertă', {
              userId: socket.user.id, userRole: socket.user.role,
              entityType: 'auction', entityId: auctionId,
            });
          return callback({ error: 'Doar furnizorii pot oferta' });
        }

        if (auction.buyer.toString() === socket.user.id) {
          logger.security(EVENTS.BID.UNAUTHORIZED,
            'Buyer a încercat să oferteze la propria licitație', {
              userId: socket.user.id, entityType: 'auction', entityId: auctionId,
            });
          return callback({ error: 'Nu poti licita la propria licitatie' });
        }

        if (amount >= auction.currentPrice) {
          logger.warn(EVENTS.BID.INVALID_AMOUNT,
            'Ofertă respinsă — sumă prea mare', {
              userId:   socket.user.id,
              entityType: 'auction', entityId: auctionId,
              metadata: { offeredAmount: amount, currentPrice: auction.currentPrice },
            });
          return callback({ error: `Oferta trebuie sa fie sub ${auction.currentPrice} RON` });
        }

        /* ── Auto-extend ── */
        const now      = new Date();
        const timeLeft = auction.deadline - now;
        if (auction.autoExtend && timeLeft < 2 * 60 * 1000) {
          auction.deadline = new Date(now.getTime() + 5 * 60 * 1000);
          io.to(auctionId).emit('deadline_extended', { newDeadline: auction.deadline });

          logger.info(EVENTS.AUCTION.DEADLINE_EXTENDED,
            `Deadline extins automat pentru licitația "${auction.title}"`, {
              entityType: 'auction', entityId: auctionId,
              metadata:   { newDeadline: auction.deadline },
            });
        }

        /* ── Oferta câștigătoare anterioară ── */
        const previousWinner = await Bid.findOne({
          auction:   auctionId,
          isWinning: true,
          supplier:  { $ne: socket.user.id },
        }).populate('supplier', 'firstName email _id');

        await Bid.updateMany({ auction: auctionId }, { isWinning: false });

        /* ── Creează oferta nouă ── */
        const bid = await Bid.create({
          auction:   auctionId,
          supplier:  socket.user.id,
          amount,
          message:   message || '',
          isWinning: true,
        });

        auction.currentPrice = amount;
        auction.winningBid   = bid._id;
        await auction.save();

        await Subscription.findOneAndUpdate(
          { user: socket.user.id, auction: auctionId },
          { user: socket.user.id, auction: auctionId },
          { upsert: true, new: true }
        );

        const populatedBid = await bid.populate('supplier', 'firstName lastName companyName rating');

        /* ── Audit log — ofertă depusă ── */
        logger.audit(EVENTS.BID.CREATED,
          `Ofertă depusă: ${amount} RON la "${auction.title}"`, {
            userId:    socket.user.id,
            userRole:  socket.user.role,
            entityType: 'bid',
            entityId:   bid._id.toString(),
            metadata: {
              auctionId,
              auctionTitle: auction.title,
              amount,
              currency:     'RON',
              previousPrice: auction.currentPrice,
            },
          });

        io.to(auctionId).emit('new_bid', {
          bid:          populatedBid,
          currentPrice: auction.currentPrice,
        });

        /* ── Notifică furnizorul supralicitat ── */
        if (previousWinner?.supplier) {
          const prevSupplier = previousWinner.supplier;
          if (prevSupplier.email) {
            const { subject, html } = outbidTemplate({
              firstName:    prevSupplier.firstName,
              auctionTitle: auction.title,
              newPrice:     amount,
              auctionId,
            });
            sendMail({ to: prevSupplier.email, subject, html });
          }
          io.to(`user_${prevSupplier._id}`).emit('notification', {
            type: 'outbid',
            text: `Ai fost supralicitat la "${auction.title}" — pret nou: ${amount} RON`,
            link: `/auction/${auctionId}`,
            time: new Date(),
          });
        }

        /* ── Notifică abonații ── */
        const subscriptions = await Subscription.find({ auction: auctionId })
          .populate('user', 'firstName email _id');

        const notifiedSet = new Set([socket.user.id]);
        if (previousWinner?.supplier?._id) {
          notifiedSet.add(previousWinner.supplier._id.toString());
        }

        for (const sub of subscriptions) {
          if (!sub.user) continue;
          const uid = sub.user._id.toString();
          if (notifiedSet.has(uid)) continue;
          notifiedSet.add(uid);

          io.to(`user_${uid}`).emit('notification', {
            type: 'bid',
            text: `Oferta noua la "${auction.title}": ${amount} RON`,
            link: `/auction/${auctionId}`,
            time: new Date(),
          });

          sendMail({
            to:      sub.user.email,
            subject: `RevBid — Oferta noua la "${auction.title}"`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
                <h2 style="color:#033667">Oferta noua la licitatia ta urmarita</h2>
                <p>Salut <strong>${sub.user.firstName}</strong>,</p>
                <p>A fost depusa o oferta noua la <strong>"${auction.title}"</strong>.</p>
                <div style="background:#EAF4F7;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
                  <p style="margin:0;color:#6B7C86;font-size:14px">Pret curent</p>
                  <p style="margin:4px 0;font-size:28px;font-weight:bold;color:#00A99D">${amount} RON</p>
                </div>
                <a href="${process.env.CLIENT_URL}/auction/${auctionId}"
                   style="display:inline-block;background:#00A99D;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                  Vezi licitatia
                </a>
              </div>
            `,
          });
        }

        callback({ success: true, bid: populatedBid });

      } catch (err) {
        logger.error(EVENTS.SOCKET.BID_REJECTED,
          `Eroare la depunere ofertă: ${err.message}`, {
            userId:   socket.user?.id,
            errorName:    err.name,
            errorMessage: err.message,
            stack:        err.stack,
          });
        callback({ error: 'Eroare server: ' + err.message });
      }
    });

    /* ── Deconectare ────────────────────────────────────────── */
    socket.on('disconnect', (reason) => {
      logger.info(EVENTS.SOCKET.DISCONNECTED,
        `User deconectat din Socket.IO`, {
          userId:   socket.user.id,
          userRole: socket.user.role,
          metadata: { reason },
        });
    });
  });
};
