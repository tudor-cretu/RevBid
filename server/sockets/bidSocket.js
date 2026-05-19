const jwt          = require('jsonwebtoken');
const Auction      = require('../models/Auction');
const Bid          = require('../models/Bid');
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');
const sendMail     = require('../config/mailer');
const { outbidTemplate } = require('../config/emailTemplates');
const notifyUser   = require('../utils/notify');

module.exports = (io) => {

  // ── Socket auth middleware ───────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token lipsa'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user   = decoded;
      next();
    } catch {
      next(new Error('Token invalid'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User conectat: ${socket.user.id} (${socket.user.role})`);

    // Fiecare user intra in propriul room pentru notificari personale
    socket.join(`user_${socket.user.id}`);

    // ── Livreaza notificarile necitite din DB la conectare ───────
    // Asa utilizatorii care erau offline primesc notificarile pierdute
    try {
      const unread = await Notification.find({
        user: socket.user.id,
        read: false,
      }).sort({ createdAt: -1 }).limit(50);

      for (const n of unread) {
        socket.emit('notification', {
          _id:  n._id.toString(),
          type: n.type,
          text: n.text,
          link: n.link,
          time: n.createdAt,
          read: false,
        });
      }

      if (unread.length > 0) {
        console.log(`Livrate ${unread.length} notificari necitite catre ${socket.user.id}`);
      }
    } catch (err) {
      console.error('Eroare livrare notificari offline:', err.message);
    }

    // ── Intra in camera licitatiei ───────────────────────────────
    socket.on('join_auction', (auctionId) => {
      socket.join(auctionId);
      console.log(`User ${socket.user.id} a intrat in licitatia ${auctionId}`);
    });

    socket.on('leave_auction', (auctionId) => {
      socket.leave(auctionId);
    });

    // ── Depune oferta ────────────────────────────────────────────
    socket.on('place_bid', async (data, callback) => {
      try {
        const { auctionId, amount, message } = data;

        // ── Validari ──
        const auction = await Auction.findById(auctionId);
        if (!auction)                              return callback({ error: 'Licitatia nu exista' });
        if (auction.status !== 'active')           return callback({ error: 'Licitatia nu e activa' });
        if (socket.user.role !== 'supplier')       return callback({ error: 'Doar furnizorii pot oferta' });
        if (auction.buyer.toString() === socket.user.id) return callback({ error: 'Nu poti licita la propria licitatie' });
        if (amount >= auction.currentPrice)        return callback({ error: `Oferta trebuie sa fie sub ${auction.currentPrice} RON` });

        // ── Auto-extend ──
        const now      = new Date();
        const timeLeft = auction.deadline - now;
        if (auction.autoExtend && timeLeft < 2 * 60 * 1000) {
          auction.deadline = new Date(now.getTime() + 5 * 60 * 1000);
          io.to(auctionId).emit('deadline_extended', { newDeadline: auction.deadline });
        }

        // ── Gaseste furnizorul supralicitat ──
        const previousWinner = await Bid.findOne({
          auction:   auctionId,
          isWinning: true,
          supplier:  { $ne: socket.user.id },
        }).populate('supplier', 'firstName email _id');

        // ── Reseteaza isWinning ──
        await Bid.updateMany({ auction: auctionId }, { isWinning: false });

        // ── Creeaza oferta noua ──
        const bid = await Bid.create({
          auction:   auctionId,
          supplier:  socket.user.id,
          amount,
          message:   message || '',
          isWinning: true,
        });

        // ── Actualizeaza pretul curent ──
        auction.currentPrice = amount;
        auction.winningBid   = bid._id;
        await auction.save();

        // ── Auto-abonat: furnizorul se aboneaza automat la licitatie ──
        await Subscription.findOneAndUpdate(
          { user: socket.user.id, auction: auctionId },
          { user: socket.user.id, auction: auctionId },
          { upsert: true, new: true }
        );

        // ── Populeaza oferta ──
        const populatedBid = await bid.populate('supplier', 'firstName lastName companyName rating');

        // ── Broadcast oferta noua in camera licitatiei ──
        io.to(auctionId).emit('new_bid', {
          bid:          populatedBid,
          currentPrice: auction.currentPrice,
        });

        // ── Notifica furnizorul supralicitat (DB + socket + email) ──
        if (previousWinner?.supplier) {
          const prev = previousWinner.supplier;

          // Email
          if (prev.email) {
            const { subject, html } = outbidTemplate({
              firstName:    prev.firstName,
              auctionTitle: auction.title,
              newPrice:     amount,
              auctionId,
            });
            sendMail({ to: prev.email, subject, html });
          }

          // Notificare persistata + socket
          await notifyUser(io, prev._id.toString(), {
            type: 'outbid',
            text: `Ai fost supralicitat la "${auction.title}" — pret nou: ${amount} RON`,
            link: `/auction/${auctionId}`,
          });
        }

        // ── Notifica toti abonati (exclusiv emitentul si cel supralicitat) ──
        const subscriptions = await Subscription.find({ auction: auctionId })
          .populate('user', 'firstName email _id');

        const notifiedSet = new Set();
        notifiedSet.add(socket.user.id);
        if (previousWinner?.supplier?._id) {
          notifiedSet.add(previousWinner.supplier._id.toString());
        }

        for (const sub of subscriptions) {
          if (!sub.user) continue;
          const uid = sub.user._id.toString();
          if (notifiedSet.has(uid)) continue;
          notifiedSet.add(uid);

          // Notificare persistata + socket
          await notifyUser(io, uid, {
            type: 'bid',
            text: `Oferta noua la "${auction.title}": ${amount} RON`,
            link: `/auction/${auctionId}`,
          });

          // Email
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
                <p style="margin-top:24px;font-size:12px;color:#999">RevBid — Platforma de licitatii inverse</p>
              </div>
            `,
          });
        }

        // ── Confirmare catre emitent ──
        callback({ success: true, bid: populatedBid });

      } catch (err) {
        console.error('place_bid error:', err);
        callback({ error: 'Eroare server: ' + err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User deconectat: ${socket.user.id}`);
    });
  });
};
