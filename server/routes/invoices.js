'use strict';

const router         = require('express').Router();
const Invoice        = require('../models/Invoice');
const authMiddleware = require('../middleware/auth');
const { buildInvoicePdf } = require('../utils/invoiceDoc');
const { companyCompleteness } = require('../utils/company');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');

/**
 * Încarcă invoice-ul unei licitații și verifică permisiunile.
 * Acces permis doar: buyer-ul, furnizorul câștigător, admin.
 * @returns {Promise<{invoice, role}|null>} null dacă a răspuns deja cu eroare.
 */
async function loadAuthorized(req, res) {
  const invoice = await Invoice.findOne({ auction: req.params.auctionId })
    .populate('buyer',    'firstName lastName companyName email phone avatar rating role company')
    .populate('supplier', 'firstName lastName companyName email phone avatar rating role company');

  if (!invoice) {
    res.status(404).json({ message: 'Nu există un document pentru această licitație' });
    return null;
  }

  const uid     = req.user.id;
  const buyerId = invoice.buyer?._id?.toString();
  const suppId  = invoice.supplier?._id?.toString();

  let role = null;
  if (req.user.role === 'admin') role = 'admin';
  else if (uid === buyerId)      role = 'buyer';
  else if (uid === suppId)       role = 'winner';

  if (!role) {
    logger.fromReq(req).security(EVENTS.INVOICE.ACCESS_DENIED,
      'Acces neautorizat la document de tranzacție', {
        entityType: 'invoice', entityId: invoice._id.toString(),
        metadata: { auctionId: req.params.auctionId } });
    res.status(403).json({ message: 'Nu ai acces la acest document' });
    return null;
  }

  return { invoice, role };
}

const party = u => (u ? {
  _id:         u._id,
  firstName:   u.firstName,
  lastName:    u.lastName,
  companyName: u.companyName,
  role:        u.role,
  email:       u.email,
  phone:       u.phone,
  avatar:      u.avatar,
  rating:      u.rating,
} : null);

/* ── GET /api/invoices/auction/:auctionId — metadata + contraparte ── */
router.get('/auction/:auctionId', authMiddleware, async (req, res) => {
  try {
    const r = await loadAuthorized(req, res);
    if (!r) return;
    const { invoice, role } = r;

    /* Datele de contact ale celeilalte părți — vizibile doar după
       finalizare și doar buyer-ului / câștigătorului. */
    let counterparty = null;
    if (role === 'buyer')  counterparty = party(invoice.supplier);
    if (role === 'winner') counterparty = party(invoice.buyer);

    /* Starea propriilor date de companie — pentru CTA-ul din UI.
       Nu expunem datele fiscale ale contrapărții în acest endpoint. */
    let myCompany = null;
    if (role === 'buyer')  myCompany = invoice.buyer?.company;
    if (role === 'winner') myCompany = invoice.supplier?.company;
    const myCompanyComplete = role === 'admin'
      ? true
      : companyCompleteness(myCompany).complete;

    res.json({
      invoiceNumber: invoice.invoiceNumber,
      amount:        invoice.amount,
      currency:      invoice.currency,
      status:        invoice.status,
      auctionTitle:  invoice.auctionTitle,
      deadline:      invoice.deadline,
      finalizedAt:   invoice.finalizedAt,
      generatedAt:   invoice.generatedAt,
      role,
      counterparty,
      myCompanyComplete,
    });
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server' });
  }
});

/* ── GET /api/invoices/auction/:auctionId/download — PDF ──────────── */
router.get('/auction/:auctionId/download', authMiddleware, async (req, res) => {
  try {
    const r = await loadAuthorized(req, res);
    if (!r) return;
    const { invoice, role } = r;

    const pdf = await buildInvoicePdf(invoice);

    logger.fromReq(req).audit(EVENTS.INVOICE.DOWNLOADED,
      `Document de tranzacție descărcat: ${invoice.invoiceNumber}`, {
        entityType: 'invoice', entityId: invoice._id.toString(),
        metadata: { role } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RevBid-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (err) {
    logger.logReqError(req, EVENTS.SYSTEM.UNHANDLED_ERROR, err);
    res.status(500).json({ message: 'Eroare server' });
  }
});

module.exports = router;
