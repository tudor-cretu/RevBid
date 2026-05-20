const mongoose = require('mongoose');

/* Contor atomic — folosit pentru numere secvențiale unice (ex: invoice). */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // ex: 'invoice-2026'
  seq: { type: Number, default: 0 },
});

/* Incrementează atomic și returnează noua valoare. */
counterSchema.statics.next = async function (key) {
  const doc = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
