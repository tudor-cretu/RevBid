const jwt          = require('jsonwebtoken');
const Auction      = require('../models/Auction');
const Bid          = require('../models/Bid');
const Subscription = require('../models/Subscription');
const User         = require('../models/User');
const sendMail     = require('../config/mailer');
const { outbidTemplate } = require('../config/emailTemplates');

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

  io.on('connection', (socket) => {
    console.log(`User conectat: ${socket.user.id} (${socket.user.role})`);

    // Fiecare user intra in propriul room pentru notificari personale
    socket.join(`user_${socket.user.id}`);

    // ── Intra in camera licitatiei ───────────────────────────
    socket.on('join_auction', (auctionId) => {
      socket.join(auctionId);
      console.log(`User ${socket.user.id} a intrat in licitatia ${auctionId}`);
    });

    socket.on('leave_auction', (auctionId) => {
      socket.leave(auctionId);
    });

    // ── Depune oferta ────────────────────────────────────────
    socket.on('place_bid', async (data, callback) => {
      try {
        const { auctionId, amount, message } = data;

        // ── Validari ──
        const auction = await Auction.findById(auctionId);
        if (!auction)                             return callback({ error: 'Licitatia nu exista' });
        if (auction.status !== 'active')          return callback({ error: 'Licitatia nu e activa' });
        if (socket.user.role !== 'supplier')      return callback({ error: 'Doar furnizorii pot oferta' });
        if (auction.buyer.toString() === socket.user.id) return callback({ error: 'Nu poti licita la propria licitatie' });
        if (amount >= auction.currentPrice)       return callback({ error: `Oferta trebuie sa fie sub ${auction.currentPrice} RON` });

        // ── Auto-extend ──
        const now      = new Date();
        const timeLeft = auction.deadline - now;
        if (auction.autoExtend && timeLeft < 2 * 60 * 1000) {
          auction.deadline = new Date(now.getTime() + 5 * 60 * 1000);
          io.to(auctionId).emit('deadline_extended', { newDeadline: auction.deadline });
        }

        // ── Gaseste furnizorul supralicitat (oferta castigatoare anterioara) ──
        const previousWinner = await Bid.findOne({
          auction:   auctionId,
          isWinning: true,
          supplier:  { $ne: socket.user.id },
        }).populate('supplier', 'firstName email _id');

        // ── Reseteaza isWinning pe toate ofertele anterioare ──
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

        // ── Auto-abonat la licitatie ──
        // Furnizorul care oferteza se aboneaza automat
        await Subscription.findOneAndUpdate(
          { user: socket.user.id, auction: auctionId },
          { user: socket.user.id, auction: auctionId },
          { upsert: true, new: true }
        );

        // ── Populeaza oferta pentru emit ──
        const populatedBid = await bid.populate('supplier', 'firstName lastName companyName rating');

        // ── Trimite oferta noua tuturor din camera licitatiei ──
        io.to(auctionId).emit('new_bid', {
          bid:          populatedBid,
          currentPrice: auction.currentPrice,
        });

        // ── Notifica furnizorul supralicitat ──
        if (previousWinner?.supplier) {
          const prevSupplier = previousWinner.supplier;

          // Email
          if (prevSupplier.email) {
            const { subject, html } = outbidTemplate({
              firstName:    prevSupplier.firstName,
              auctionTitle: auction.title,
              newPrice:     amount,
              auctionId,
            });
            sendMail({ to: prevSupplier.email, subject, html });
          }

          // Notificare in-app
          io.to(`user_${prevSupplier._id}`).emit('notification', {
            type: 'outbid',
            text: `Ai fost supralicitat la "${auction.title}" — pret nou: ${amount} RON`,
            link: `/auction/${auctionId}`,
            time: new Date(),
          });
        }

        // ── Colecteaza toti abonati la aceasta licitatie ──
        const subscriptions = await Subscription.find({ auction: auctionId })
          .populate('user', 'firstName email _id');

        const notifiedSet = new Set();
        // Nu notifica cel care a ofertat acum
        notifiedSet.add(socket.user.id);
        // Nu notifica din nou furnizorul supralicitat (deja notificat mai sus)
        if (previousWinner?.supplier?._id) {
          notifiedSet.add(previousWinner.supplier._id.toString());
        }

        for (const sub of subscriptions) {
          if (!sub.user) continue;
          const uid = sub.user._id.toString();
          if (notifiedSet.has(uid)) continue;
          notifiedSet.add(uid);

          // Notificare in-app
          io.to(`user_${uid}`).emit('notification', {
            type: 'bid',
            text: `Oferta noua la "${auction.title}": ${amount} RON`,
            link: `/auction/${auctionId}`,
            time: new Date(),
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

        // ── Confirmare pentru emitator ──
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