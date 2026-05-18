const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const http     = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' }
});
const session  = require('express-session');
const passport = require('./config/passport');

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use(session({
  secret:            process.env.SESSION_SECRET || 'revbid_secret',
  resave:            false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/upload',  require('./routes/upload'));
app.use('/api/bids', require('./routes/bids'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/support', require('./routes/support'));
app.use('/api/messages', require('./routes/messages'));

app.get('/', (req, res) => res.json({ message: 'RevBid API running' }));

// Ataseaza io la app ca sa il folosim din routes
app.set('io', io);

require('./jobs/auctionCloser')(io);
require('./sockets/bidSocket')(io);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));