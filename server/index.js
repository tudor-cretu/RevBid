'use strict';

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const http     = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger          = require('./utils/logger');
const EVENTS          = require('./utils/events');
const requestId       = require('./middleware/requestId');
const requestLogger   = require('./middleware/requestLogger');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' }
});
const session  = require('express-session');
const passport = require('./config/passport');

/* ── Middleware globale ──────────────────────────────────────── */
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

/* Request ID — trebuie să fie primul, înainte de orice logging */
app.use(requestId);

/* HTTP Request Logger */
app.use(requestLogger);

app.use(session({
  secret:            process.env.SESSION_SECRET || 'revbid_secret',
  resave:            false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

/* ── Rute ────────────────────────────────────────────────────── */
app.use('/api/auth',             require('./routes/auth'));
app.use('/api/auctions',         require('./routes/auctions'));
app.use('/api/upload',           require('./routes/upload'));
app.use('/api/bids',             require('./routes/bids'));
app.use('/api/admin',            require('./routes/admin'));
app.use('/api/support',          require('./routes/support'));
app.use('/api/messages',         require('./routes/messages'));
app.use('/api/subscriptions',    require('./routes/subscriptions'));
app.use('/api/notifications',    require('./routes/notifications'));
app.use('/api/auction-requests', require('./routes/auctionRequests'));


app.get('/', (req, res) => res.json({ message: 'RevBid API running' }));

/* ── 404 handler ─────────────────────────────────────────────── */
app.use((req, res, next) => {
  logger.fromReq(req).warn(EVENTS.SYSTEM.NOT_FOUND,
    `Rută inexistentă: ${req.method} ${req.path}`, {
      statusCode: 404,
    });
  res.status(404).json({ message: 'Ruta nu există' });
});

/* ── Global error handler ─────────────────────────────────────
   Prinde orice eroare ne-tratată aruncată în rute.
   În Express 5 async errors sunt propagate automat.          */
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err, {
    statusCode,
  });

  /* Nu expunem stack trace sau detalii interne în producție */
  const isDev = process.env.NODE_ENV === 'development';
  res.status(statusCode).json({
    message: statusCode < 500 ? err.message : 'Eroare internă server',
    ...(isDev && { debug: err.message }),
  });
});

/* ── Socket.IO ───────────────────────────────────────────────── */
app.set('io', io);
require('./jobs/auctionCloser')(io);
require('./sockets/bidSocket')(io);

/* ── Erori neașteptate la nivel de process ─────────────────── */
process.on('uncaughtException', (err) => {
  logger.error(EVENTS.SYSTEM.UNHANDLED_ERROR,
    `uncaughtException: ${err.message}`, {
      errorName:    err.name,
      errorMessage: err.message,
      stack:        err.stack,
    });
  /* Dăm o șansă logger-ului să scrie, apoi oprim procesul */
  setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(EVENTS.SYSTEM.UNHANDLED_ERROR,
    `unhandledRejection: ${err.message}`, {
      errorName:    err.name,
      errorMessage: err.message,
      stack:        err.stack,
    });
});

/* ── MongoDB ─────────────────────────────────────────────────── */
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    logger.info(EVENTS.SYSTEM.DB_CONNECTED, 'MongoDB conectat cu succes', {
      metadata: { uri: process.env.MONGO_URI?.replace(/\/\/.*@/, '//***@') },
    });
  })
  .catch(err => {
    logger.error(EVENTS.SYSTEM.DB_ERROR, `MongoDB eroare de conectare: ${err.message}`, {
      errorName:    err.name,
      errorMessage: err.message,
    });
  });

/* ── Start server ────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(EVENTS.SYSTEM.SERVER_START,
    `RevBid API pornit pe portul ${PORT}`, {
      metadata: {
        port:     PORT,
        env:      process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'debug',
      },
    });
});
