/**
 * notifyUser — save notification to DB and emit to user socket if online.
 *
 * @param {import('socket.io').Server} io
 * @param {string} userId   Mongoose ObjectId as string
 * @param {{ type: string, text: string, link: string }} notif
 * @returns {Promise<void>}
 */
const Notification = require('../models/Notification');

async function notifyUser(io, userId, notif) {
  try {
    // 1. Persist to DB (works regardless of online state)
    const saved = await Notification.create({
      user: userId,
      type: notif.type || 'info',
      text: notif.text,
      link: notif.link || '/',
    });

    // 2. Emit to user room if they are currently connected
    io.to(`user_${userId}`).emit('notification', {
      _id:  saved._id.toString(),
      type: saved.type,
      text: saved.text,
      link: saved.link,
      time: saved.createdAt,
      read: false,
    });
  } catch (err) {
    console.error('notifyUser error:', err.message);
  }
}

module.exports = notifyUser;
