'use strict';

const jwt          = require('jsonwebtoken');
const mongoose     = require('mongoose');
const cookie       = require('cookie');
const Auction      = require('../models/Auction');
const Bid          = require('../models/Bid');
const User         = require('../models/User');
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');
const sendMail     = require('../config/mailer');
const { outbidTemplate, newBidTemplate } = require('../config/emailTemplates');
const notifyUser   = require('../utils/notify');
const logger       = require('../utils/logger');
const EVENTS       = require('../utils/events');

/* ── Constante de business ────────────────────────────────────
   MIN_BID_DECREMENT — în licitația inversă, fiecare nouă ofertă
   trebuie să fie cu cel puțin atâta MAI MICĂ decât prețul curent.
   Împiedică gaming-ul cu pași de 0.01 RON care produce zgomot
   masiv în UI și forțează update-uri inutile.                       */
const MIN_BID_DECREMENT = 1;   // 1 RON
const MAX_BID_VALUE     = 1_000_000_000;
const AUTO_EXTEND_MS    = 2 * 60 * 1000;  // 2 minute prag
const AUTO_EXTEND_BY    = 5 * 60 * 1000;  // extinde cu 5 minute

module.exports = (io) => {

  // ── Socket auth middleware ─────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      /* Tokenul poate veni:
         - din handshake.auth.token (clienții care folosesc Bearer)
         - din cookie-ul httpOnly (clienții cu auth pe cookie)        */
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers?.cookie) {
        try {
          const parsed = cookie.parse(socket.handshake.headers.cookie || '');
          token = parsed.revbid_token || null;
        } catch { /* ignore parse errors */ }
      }
      if (!token) return next(new Error('Token lipsă'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      /* Verificare ban — un user banat NU se poate conecta la socket
         indiferent că JWT-ul lui mai e valid. Lookup-ul costă o singură
         interogare pe conexiune.                                        */
      const dbUser = await User.findById(decoded.id).select('isBanned role isVerified email');
      if (!dbUser) {
        return next(new Error('Utilizator inexistent'));
      }
      if (dbUser.isBanned) {
        logger.security(EVENTS.AUTH.LOGIN_BANNED,
          'Conectare socket refuzată — cont suspendat', {
            entityType: 'user',
            entityId:   decoded.id,
          });
        return next(new Error('Cont suspendat'));
      }

      /* Atașăm DB-fresh role/email — nu ne bazăm doar pe JWT. */
      socket.user = {
        id:    decoded.id,
        role:  dbUser.role,
        email: dbUser.email,
      };
      next();
    } catch (err) {
      next(new Error('Token invalid sau expirat'));
    }
  });

  io.on('connection', async (socket) => {
    logger.debug(EVENTS.SYSTEM.SERVER_START,
      `Socket conectat: ${socket.user.id} (${socket.user.role})`,
      { entityType: 'user', entityId: socket.user.id });

    // Fiecare user intra in propriul room pentru notificari personale
    socket.join(`user_${socket.user.id}`);

    // ── Livrare notificări necitite din DB la conectare ──────────
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
    } catch (err) {
      logger.error(EVENTS.SYSTEM.UNHANDLED_ERROR,
        `Eroare livrare notificări offline: ${err.message}`,
        { entityType: 'user', entityId: socket.user.id });
    }

    // ── Intra in camera licitatiei ───────────────────────────────
    socket.on('join_auction', (auctionId) => {
      if (typeof auctionId !== 'string') return;
      if (!mongoose.Types.ObjectId.isValid(auctionId)) return;
      socket.join(auctionId);
    });

    socket.on('leave_auction', (auctionId) => {
      if (typeof auctionId !== 'string') return;
      socket.leave(auctionId);
    });

    // ── Depune oferta ────────────────────────────────────────────
    socket.on('place_bid', async (data, callback) => {
      if (typeof callback !== 'function') callback = () => {};

      try {
        const { auctionId, amount, message } = data || {};

        /* ── Validări de tip / format ── */
        if (!auctionId || typeof auctionId !== 'string'
            || !mongoose.Types.ObjectId.isValid(auctionId)) {
          return callback({ error: 'ID licitație invalid' });
        }

        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0 || amt > MAX_BID_VALUE) {
          return callback({ error: 'Sumă ofertă invalidă' });
        }

        if (socket.user.role !== 'supplier') {
          return callback({ error: 'Doar furnizorii pot oferta' });
        }

        const msg = typeof message === 'string'
          ? message.trim().slice(0, 500)
          : '';

        /* ── Verificare bază — citire snapshot pentru validări. ── */
        const auctionSnapshot = await Auction.findById(auctionId)
          .select('buyer status currentPrice deadline autoExtend title');
        if (!auctionSnapshot) {
          return callback({ error: 'Licitația nu există' });
        }
        if (auctionSnapshot.status !== 'active') {
          return callback({ error: 'Licitația nu e activă' });
        }
        if (auctionSnapshot.buyer.toString() === socket.user.id) {
          return callback({ error: 'Nu poți licita la propria licitație' });
        }

        /* În licitație inversă: oferta nouă trebuie să fie SUB
           currentPrice cu cel puțin MIN_BID_DECREMENT.                  */
        const maxAllowed = auctionSnapshot.currentPrice
          ? auctionSnapshot.currentPrice - MIN_BID_DECREMENT
          : Infinity;
        if (amt > maxAllowed) {
          return callback({
            error: `Oferta trebuie să fie cu cel puțin ${MIN_BID_DECREMENT} RON sub prețul curent (max: ${maxAllowed.toFixed(2)} RON)`,
          });
        }

        /* ── Update atomic al currentPrice cu guard pe valoarea curentă ──
           Acesta este punctul critic anti-race: doar UNA dintre cererile
           concurente va găsi currentPrice >= amt + MIN_BID_DECREMENT și va
           reuși update-ul. Restul vor primi null și vor fi respinse.        */
        const updatedAuction = await Auction.findOneAndUpdate(
          {
            _id:          auctionId,
            status:       'active',
            currentPrice: { $gte: amt + MIN_BID_DECREMENT },
          },
          {
            $set: { currentPrice: amt },
          },
          { new: true },
        );

        if (!updatedAuction) {
          /* Cineva ne-a luat-o înainte — alt furnizor a oferit între
             snapshot și update. Reîncearcă cu o sumă mai mică.            */
          const fresh = await Auction.findById(auctionId).select('currentPrice');
          const newMax = fresh
            ? (fresh.currentPrice - MIN_BID_DECREMENT).toFixed(2)
            : '?';
          return callback({
            error: `Cineva tocmai a ofertat mai mult. Oferta maximă permisă acum: ${newMax} RON`,
          });
        }

        /* ── Marcăm ofertele anterioare ca ne-câștigătoare, ATOMIC ── */
        await Bid.updateMany(
          { auction: auctionId, isWinning: true },
          { $set: { isWinning: false } },
        );

        /* ── Creează oferta nouă (singura cu isWinning=true) ── */
        const bid = await Bid.create({
          auction:   auctionId,
          supplier:  socket.user.id,
          amount:    amt,
          message:   msg,
          isWinning: true,
        });

        /* Salvăm winningBid pe licitație + auto-extend dacă e nevoie. */
        const now = new Date();
        const updatePatch = { winningBid: bid._id };
        let deadlineExtended = false;
        if (updatedAuction.autoExtend
            && updatedAuction.deadline - now < AUTO_EXTEND_MS
            && updatedAuction.deadline - now > 0) {
          updatePatch.deadline = new Date(now.getTime() + AUTO_EXTEND_BY);
          deadlineExtended = true;
        }
        const finalAuction = await Auction.findByIdAndUpdate(
          auctionId, { $set: updatePatch }, { new: true }
        );

        /* Găsim furnizorul supralicitat — bidul precedent câștigător. */
        const previousWinner = await Bid.findOne({
          auction:   auctionId,
          isWinning: false,
          supplier:  { $ne: socket.user.id },
        }).sort({ updatedAt: -1 });

        /* Auto-abonat — furnizorul se abonează automat la licitație. */
        await Subscription.findOneAndUpdate(
          { user: socket.user.id, auction: auctionId },
          { user: socket.user.id, auction: auctionId },
          { upsert: true, new: true },
        );

        /* ── Broadcast în camera licitației ── */
        const populatedBid = await Bid.findById(bid._id)
          .populate('supplier', 'firstName lastName companyName rating');

        if (deadlineExtended) {
          io.to(auctionId).emit('deadline_extended', { newDeadline: finalAuction.deadline });
        }

        io.to(auctionId).emit('new_bid', {
          bid:          populatedBid,
          currentPrice: finalAuction.currentPrice,
        });

        /* ── Notificare furnizor supralicitat ── */
        if (previousWinner) {
          const prevUser = await User.findById(previousWinner.supplier)
            .select('firstName email _id');

          if (prevUser?.email) {
            const { subject, html } = outbidTemplate({
              firstName:    prevUser.firstName,
              auctionTitle: finalAuction.title,
              newPrice:     amt,
              auctionId,
            });
            sendMail({ to: prevUser.email, subject, html });
          }

          if (prevUser) {
            await notifyUser(io, prevUser._id.toString(), {
              type: 'outbid',
              text: `Ai fost supralicitat la "${finalAuction.title}" — pret nou: ${amt} RON`,
              link: `/auction/${auctionId}`,
            });
          }
        }

        /* ── Notifică abonații (exclusiv emitent + cel supralicitat) ── */
        const subscriptions = await Subscription.find({ auction: auctionId })
          .populate('user', 'firstName email _id');

        const notifiedSet = new Set();
        notifiedSet.add(socket.user.id);
        if (previousWinner?.supplier) {
          notifiedSet.add(previousWinner.supplier.toString());
        }

        const buyerIdStr = finalAuction.buyer.toString();

        for (const sub of subscriptions) {
          if (!sub.user) continue;
          const uid = sub.user._id.toString();
          if (notifiedSet.has(uid)) continue;
          notifiedSet.add(uid);

          const isOwner = uid === buyerIdStr;

          await notifyUser(io, uid, {
            type: 'bid',
            text: isOwner
              ? `Ofertă nouă la licitația ta "${finalAuction.title}": ${amt} RON`
              : `Ofertă nouă la "${finalAuction.title}": ${amt} RON`,
            link: `/auction/${auctionId}`,
          });

          if (sub.user.email) {
            const { subject, html } = newBidTemplate({
              firstName:    sub.user.firstName,
              auctionTitle: finalAuction.title,
              amount:       amt,
              auctionId,
              isOwner,
            });
            sendMail({ to: sub.user.email, subject, html });
          }
        }

        callback({ success: true, bid: populatedBid });

      } catch (err) {
        logger.error(EVENTS.SYSTEM.UNHANDLED_ERROR,
          `place_bid error: ${err.message}`, {
            entityType: 'user',
            entityId:   socket.user?.id,
            metadata:   { auctionId: data?.auctionId, amount: data?.amount },
          });
        callback({ error: err.message || 'Eroare server' });
      }
    });

    socket.on('disconnect', () => {
      logger.debug(EVENTS.SYSTEM.SERVER_START,
        `Socket deconectat: ${socket.user.id}`,
        { entityType: 'user', entityId: socket.user.id });
    });
  });
};
