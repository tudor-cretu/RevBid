'use strict';

const mongoose = require('mongoose');

/**
 * Middleware factory pentru validarea unui parametru de tip ObjectId din URL.
 * Întoarce 400 dacă valoarea nu este un ObjectId valid — împiedică
 * aruncarea de excepții pe Model.findById() cu un id stricat.
 *
 *   router.get('/:id', validateObjectId('id'), handler);
 *   router.get('/:auctionId/bids', validateObjectId('auctionId'), handler);
 */
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({
        message: `Parametru ${paramName} invalid`,
      });
    }
    /* Suplimentar: în mongoose, ObjectId.isValid() returnează true și pentru
       string-uri de 12 caractere. Verificăm că reprezentarea hex e identică. */
    if (String(new mongoose.Types.ObjectId(value)) !== String(value)) {
      return res.status(400).json({
        message: `Parametru ${paramName} invalid`,
      });
    }
    next();
  };
}

/** Validare în-line — true / false fără middleware. */
function isValidObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return false;
  return String(new mongoose.Types.ObjectId(value)) === String(value);
}

module.exports = { validateObjectId, isValidObjectId };
