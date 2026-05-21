'use strict';

/**
 * RevBid — Utilitare pentru datele de companie / date fiscale.
 * ─────────────────────────────────────────────────────────────────
 * Normalizare, validare, formatare adresă și snapshot pentru invoice.
 * Aceeași logică e oglindită în client (validare UX) — server-ul rămâne
 * sursa de adevăr.
 */

const COUNTRY_DEFAULT = 'România';

/* C.U.I./C.I.F. — elimină spațiile, uppercase. Prefixul fiscal RO e opțional. */
function normalizeTaxId(raw) {
  if (!raw) return '';
  return String(raw).replace(/\s+/g, '').toUpperCase();
}

/* Nr. Registrul Comerțului — elimină spațiile, uppercase. */
function normalizeRegNumber(raw) {
  if (!raw) return '';
  return String(raw).replace(/\s+/g, '').toUpperCase();
}

const TAX_ID_RE  = /^(RO)?\d{2,10}$/;            // 12345678 sau RO12345678
const REG_NUM_RE = /^[JFC]\d{1,2}\/\d{1,7}\/\d{4}$/; // J40/1234/2026, F40/1234/2026

const trimStr = v => (typeof v === 'string' ? v.trim() : '');

/* Construiește un obiect company curat din input-ul brut (request body). */
function normalizeCompanyInput(raw = {}) {
  const a = (raw && raw.address) || {};
  return {
    legalName:           trimStr(raw.legalName),
    taxId:               normalizeTaxId(raw.taxId),
    tradeRegisterNumber: normalizeRegNumber(raw.tradeRegisterNumber),
    address: {
      country:    trimStr(a.country) || COUNTRY_DEFAULT,
      county:     trimStr(a.county),
      city:       trimStr(a.city),
      street:     trimStr(a.street),
      number:     trimStr(a.number),
      building:   trimStr(a.building),
      staircase:  trimStr(a.staircase),
      floor:      trimStr(a.floor),
      apartment:  trimStr(a.apartment),
      postalCode: trimStr(a.postalCode),
    },
  };
}

/* True dacă utilizatorul a completat măcar un câmp relevant de companie.
   Țara are o valoare implicită, deci nu o numărăm ca date introduse. */
function hasAnyCompanyData(c) {
  if (!c) return false;
  const a = c.address || {};
  return Boolean(
    c.legalName || c.taxId || c.tradeRegisterNumber ||
    a.county || a.city || a.street || a.number ||
    a.building || a.staircase || a.floor || a.apartment || a.postalCode
  );
}

/* Validează datele de companie. Returnează { valid, errors: { field: msg } }.
   Nu blochează un formular complet gol (permite golirea datelor). */
function validateCompany(c) {
  const errors = {};
  const filled = hasAnyCompanyData(c);

  if (filled && !c.legalName) {
    errors.legalName = 'Denumirea completă a firmei este obligatorie.';
  }
  if (c.taxId && !TAX_ID_RE.test(c.taxId)) {
    errors.taxId = 'C.U.I./C.I.F. invalid. Exemplu: 12345678 sau RO12345678.';
  }
  if (c.tradeRegisterNumber && !REG_NUM_RE.test(c.tradeRegisterNumber)) {
    errors.tradeRegisterNumber = 'Format invalid. Exemplu: J40/1234/2026.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/* Compune adresa sediului social pe un singur rând, pentru documente. */
function formatCompanyAddress(a = {}) {
  if (!a) return '';
  const street = [];
  if (a.street)    street.push(`Str. ${a.street}`);
  if (a.number)    street.push(`nr. ${a.number}`);
  if (a.building)  street.push(`bl. ${a.building}`);
  if (a.staircase) street.push(`sc. ${a.staircase}`);
  if (a.floor)     street.push(`et. ${a.floor}`);
  if (a.apartment) street.push(`ap. ${a.apartment}`);

  const locality = [];
  if (a.city)       locality.push(a.city);
  if (a.county)     locality.push(`jud. ${a.county}`);
  if (a.postalCode) locality.push(`CP ${a.postalCode}`);
  if (a.country)    locality.push(a.country);

  return [street.join(', '), locality.join(', ')].filter(Boolean).join(', ');
}

/* Verifică dacă datele sunt suficiente pentru un document/invoice corect. */
function companyCompleteness(c) {
  const a = (c && c.address) || {};
  const missing = [];
  if (!c || !c.legalName) missing.push('denumirea firmei');
  if (!c || !c.taxId)     missing.push('C.U.I./C.I.F.');
  if (!a.city)            missing.push('localitatea sediului');
  if (!a.street)          missing.push('strada sediului');
  return { complete: missing.length === 0, missing };
}

/* Snapshot stabil pentru invoice — obiect simplu, cu adresa pre-formatată.
   Returnează null dacă utilizatorul nu are date de companie. */
function companySnapshot(c) {
  if (!c) return null;
  const src  = c.toObject ? c.toObject() : c;
  const norm = normalizeCompanyInput(src);
  if (!hasAnyCompanyData(norm)) return null;
  return {
    legalName:           norm.legalName,
    taxId:               norm.taxId,
    tradeRegisterNumber: norm.tradeRegisterNumber,
    address:             norm.address,
    addressText:         formatCompanyAddress(norm.address),
  };
}

/* Maschează C.U.I./C.I.F. pentru logging: RO12345678 → 12***78 */
function maskTaxId(taxId) {
  if (!taxId || typeof taxId !== 'string') return '[no-taxId]';
  const raw = taxId.replace(/^RO/i, '');
  if (raw.length <= 4) return '***';
  return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}

module.exports = {
  normalizeTaxId,
  normalizeRegNumber,
  normalizeCompanyInput,
  hasAnyCompanyData,
  validateCompany,
  formatCompanyAddress,
  companyCompleteness,
  companySnapshot,
  maskTaxId,
};
