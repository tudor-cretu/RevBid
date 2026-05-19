const jwt          = require('jsonwebtoken');
const Auction      = require('../models/Auction');
const Bid          = require('../models/Bid');
const Subscription = require('../models/Subscription');
const User         = require('../models/User');
const sendMail     = require('../config/mailer');
const { outbidTemplate } = require('../config/emailTemplates');

module.exports = (io) => {

  // Middleware autentificare Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token lipsa'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Token invalid'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User conectat: ${socket.user.id}`);

    // Fiecare user intra in propriul room pentru notificari personale
    socket.join(`user_${socket.user.id}`);

    // Intra in camera licitatiei
    socket.on('join_auction', (auctionId) => {
      socket.join(auctionId);
      console.log(`User ${socket.user.id} a intrat in licitatia ${auctionId}`);
    });

    // Paraseste camera
    socket.on('leave_auction', (auctionId) => {
      socket.leave(auctionId);
    });

    // Depune oferta
    socket.on('place_bid', async (data, callback) => {
      try {
        const { auctionId, amount, message } = data;

        // Validari
        const auction = await Auction.findById(auctionId);
        if (!auction)                          return callback({ error: 'Licitatia nu exista' });
        if (auction.status !== 'active')       return callback({ error: 'Licitatia nu e activa' });
        if (socket.user.role !== 'supplier')   return callback({ error: 'Doar furnizorii pot oferta' });
        if (auction.buyer.toString() === socket.user.id) return callback({ error: 'Nu poti licita la propria licitatie' });
        if (amount >= auction.currentPrice)    return callback({ error: `Oferta trebuie sa fie sub ${auction.currentPrice} RON` });

        // Auto-extend: daca mai sunt sub 2 minute, prelungeste cu 5 minute
        const now      = new Date();
        const timeLeft = auction.deadline - now;
        if (auction.autoExtend && timeLeft < 2 * 60 * 1000) {
          auction.deadline = new Date(now.getTime() + 5 * 60 * 1000);
          io.to(auctionId).emit('deadline_extended', { newDeadline: auction.deadline });
        }

        // Gaseste furnizorul care era pe locul 1 INAINTE sa resetam isWinning
        const previousWinner = await Bid.findOne({
          auction:   auctionId,
          isWinning: true,
          supplier:  { $ne: socket.user.id },
        }).populate('supplier', 'firstName email');

        // Reseteaza isWinning pe toate ofertele anterioare
        await Bid.updateMany({ auction: auctionId }, { isWinning: false });

        // Creeaza oferta noua
        const bid = await Bid.create({
          auction:   auctionId,
          supplier:  socket.user.id,
          amount,
          message:   message || '',
          isWinning: true,
        });

        // Actualizeaza pretul curent
        auction.currentPrice = amount;
        auction.winningBid   = bid._id;
        await auction.save();

        // Trimite email furnizorului supralicitat
        if (previousWinner?.supplier?.email) {
          const { subject, html } = outbidTemplate({
            firstName:    previousWinner.supplier.firstName,
            auctionTitle: auction.title,
            newPrice:     amount,
            auctionId,
          });
          sendMail({ to: previousWinner.supplier.email, subject, html });

          // Notificare in-app pentru cel supralicitat
          io.to(`user_${previousWinner.supplier._id}`).emit('notification', {
            type:  'outbid',
            text:  `Ai fost supralicitat la "${auction.title}" — pret nou: ${amount} RON`,
            link:  `/auction/${auctionId}`,
            time:  new Date(),
          });
        }

        // Populeaza datele furnizorului pentru emit
        const populatedBid = await bid.populate('supplier', 'firstName lastName companyName rating');

        // Trimite oferta la toti din camera licitatiei
        io.to(auctionId).emit('new_bid', {
          bid:          populatedBid,
          currentPrice: auction.currentPrice,
        });

        // Notifica toti abonații (in-app + email)
        const subscriptions = await Subscription.find({ auction: auctionId })
          .populate('user', 'firstName email _id');

        for (const sub of subscriptions) {
          // Nu notifica cel care a ofertat
          if (sub.user._id.toString() === socket.user.id) continue;

          // Notificare in-app
          io.to(`user_${sub.user._id}`).emit('notification', {
            type:  'bid',
            text:  `Oferta noua la "${auction.title}": ${amount} RON`,
            link:  `/auction/${auctionId}`,
            time:  new Date(),
          });

          // Email
          sendMail({
            to:      sub.user.email,
            subject: `RevBid — Oferta noua la "${auction.title}"`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
                <h2>Oferta noua la licitatia ta urmarita</h2>
                <p>Salut <strong>${sub.user.firstName}</strong>,</p>
                <p>A fost depusa o oferta noua la <strong>"${auction.title}"</strong>.</p>
                <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
                  <p style="margin:0;color:#666;font-size:14px">Pret curent</p>
                  <p style="margin:4px 0;font-size:28px;font-weight:bold;color:#e53e3e">${amount} RON</p>
                </div>
                <a href="${process.env.CLIENT_URL}/auction/${auctionId}"
                   style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none">
                  Vezi licitatia
                </a>
                <p style="margin-top:24px;font-size:12px;color:#999">RevBid — Platforma de licitatii inverse</p>
              </div>
            `,
          });
        }

        // Confirmare catre cel care a ofertat
        callback({ success: true, bid: populatedBid });

      } catch (err) {
        callback({ error: 'Eroare server: ' + err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User deconectat: ${socket.user.id}`);
    });
  });
};