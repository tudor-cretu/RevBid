'use strict';

/**
 * RevBid — Sanitizare date sensibile pentru logging
 * ─────────────────────────────────────────────────────────────────
 * NICIODATĂ nu loga parole, tokeni completi, coduri OTP sau date personale.
 */

/**
 * Maschează un email: tudor@gmail.com → t***r@gmail.com
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '[no-email]';
  const [local, domain] = email.split('@');
  if (!domain) return '[invalid-email]';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
}

/**
 * Trunchiază un JWT token: afișează doar primele și ultimele caractere.
 * Bearer eyJh...Xyz4 → eyJh...xyz4
 */
function maskToken(token) {
  if (!token || typeof token !== 'string') return '[no-token]';
  // Elimină prefixul "Bearer " dacă există
  const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
  if (raw.length <= 10) return '[token]';
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}

/**
 * Maschează un IP pentru conformitate — păstrează doar prima componentă.
 * 192.168.1.42 → 192.168.*.*
 */
function maskIp(ip) {
  if (!ip || typeof ip !== 'string') return 'unknown';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  // IPv6 sau alte formate
  return ip.slice(0, 8) + '...';
}

/**
 * Elimină câmpurile sensibile dintr-un obiect body înainte de logging.
 * Câmpuri eliminate: password, passwordHash, newPassword, currentPassword,
 *                    verifyCode, token, refreshToken, otp, cardNumber, cvv
 */
const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'newPassword', 'currentPassword',
  'verifyCode', 'token', 'refreshToken', 'accessToken',
  'otp', 'secret', 'cardNumber', 'cvv', 'pin',
]);

function redactBody(body) {
  if (!body || typeof body !== 'object') return {};
  const result = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactBody(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Extrage meta-date sigure dintr-un request pentru logging.
 * Nu include body-ul complet — doar câmpurile alese explicit.
 */
function safeReqMeta(req) {
  return {
    method:    req.method,
    route:     req.originalUrl || req.url,
    requestId: req.requestId,
    userId:    req.user?.id || req.user?._id,
    userRole:  req.user?.role,
  };
}

module.exports = { maskEmail, maskToken, maskIp, redactBody, safeReqMeta };
