'use strict';

/**
 * RevBid — Logger centralizat
 * ─────────────────────────────────────────────────────────────────
 * Niveluri: debug < info < warn < error | audit | security
 *
 * Fișiere generate în server/logs/:
 *   app.log      — toate logurile (nivel >= configurat)
 *   error.log    — doar error
 *   audit.log    — doar audit
 *   security.log — doar security
 *
 * API:
 *   logger.info('EVENT_TYPE', 'mesaj', { meta })
 *   logger.fromReq(req).audit('BID_CREATED', 'Bid submitted', { amount })
 */

const fs   = require('fs');
const path = require('path');

/* ─── Configurare ────────────────────────────────────────────── */
const ENV       = process.env.NODE_ENV || 'development';
const IS_DEV    = ENV === 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_DEV ? 'debug' : 'info');
const LOGS_DIR  = path.join(__dirname, '..', 'logs');

/* Crează directorul logs/ dacă nu există */
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/* ─── Niveluri și priorități ─────────────────────────────────── */
const LEVELS = {
  debug:    { priority: 0, color: '\x1b[36m',  label: 'DEBUG'    }, // cyan
  info:     { priority: 1, color: '\x1b[32m',  label: 'INFO'     }, // green
  warn:     { priority: 2, color: '\x1b[33m',  label: 'WARN'     }, // yellow
  error:    { priority: 3, color: '\x1b[31m',  label: 'ERROR'    }, // red
  audit:    { priority: 4, color: '\x1b[35m',  label: 'AUDIT'    }, // magenta
  security: { priority: 5, color: '\x1b[41m',  label: 'SECURITY' }, // red bg
};

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const minPriority = LEVELS[LOG_LEVEL]?.priority ?? 0;

/* ─── Stream-uri fișiere ─────────────────────────────────────── */
function openStream(filename) {
  return fs.createWriteStream(path.join(LOGS_DIR, filename), { flags: 'a', encoding: 'utf8' });
}

const streams = {
  app:      openStream('app.log'),
  error:    openStream('error.log'),
  audit:    openStream('audit.log'),
  security: openStream('security.log'),
};

/* Reîncearcă scriere dacă stream-ul a fost închis accidental */
process.on('SIGTERM', () => { Object.values(streams).forEach(s => s.end()); });
process.on('SIGINT',  () => { Object.values(streams).forEach(s => s.end()); });

/* ─── Construcție entry JSON ─────────────────────────────────── */
function buildEntry(level, eventType, message, meta = {}) {
  const entry = {
    timestamp:  new Date().toISOString(),
    level,
    eventType,
    message,
    env:        ENV,
  };

  /* Câmpuri standard din meta — ordinea contează pentru lizibilitate */
  const ordered = [
    'requestId', 'correlationId',
    'userId', 'userRole',
    'method', 'route', 'statusCode',
    'ip', 'userAgent',
    'entityType', 'entityId',
    'durationMs',
    'metadata',
    'errorName', 'errorMessage',
  ];

  for (const key of ordered) {
    if (meta[key] !== undefined) entry[key] = meta[key];
  }

  /* Stack trace — doar în development și doar pentru erori */
  if (meta.stack && IS_DEV) {
    entry.stackTrace = meta.stack;
  }

  /* Orice câmpuri extra din meta care nu au fost acoperite */
  for (const [k, v] of Object.entries(meta)) {
    if (!ordered.includes(k) && k !== 'stack' && entry[k] === undefined) {
      entry[k] = v;
    }
  }

  return entry;
}

/* ─── Scriere consolă (dev) ──────────────────────────────────── */
function writeConsole(level, entry) {
  if (!IS_DEV) return;

  const { color, label } = LEVELS[level];
  const ts   = entry.timestamp.replace('T', ' ').replace('Z', '');
  const req  = entry.requestId ? `[${entry.requestId.slice(-8)}]` : '';
  const user = entry.userId    ? `user:${entry.userId}`           : '';
  const ctx  = [req, user].filter(Boolean).join(' ');

  const prefix = `${color}${BOLD}${label}${RESET} ${ts} ${ctx}`;
  const line   = `${prefix} ${BOLD}${entry.eventType}${RESET} — ${entry.message}`;

  if (level === 'error' || level === 'security') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

/* ─── Scriere fișier ─────────────────────────────────────────── */
function writeFile(level, entry) {
  const line = JSON.stringify(entry) + '\n';

  /* Scrie în app.log pentru orice nivel */
  streams.app.write(line);

  /* Scrie în fișierele specializate */
  if (level === 'error')    streams.error.write(line);
  if (level === 'audit')    streams.audit.write(line);
  if (level === 'security') streams.security.write(line);
}

/* ─── Funcție core ───────────────────────────────────────────── */
function log(level, eventType, message, meta = {}) {
  if (!LEVELS[level]) {
    level = 'info';
  }

  /* Filtrare după nivel minim configurat */
  /* Audit și security trec întotdeauna — sunt prea importante */
  if (level !== 'audit' && level !== 'security') {
    if (LEVELS[level].priority < minPriority) return;
  }

  const entry = buildEntry(level, eventType, message, meta);

  writeConsole(level, entry);
  writeFile(level, entry);
}

/* ─── API public ─────────────────────────────────────────────── */
const logger = {
  debug:    (eventType, message, meta) => log('debug',    eventType, message, meta),
  info:     (eventType, message, meta) => log('info',     eventType, message, meta),
  warn:     (eventType, message, meta) => log('warn',     eventType, message, meta),
  error:    (eventType, message, meta) => log('error',    eventType, message, meta),
  audit:    (eventType, message, meta) => log('audit',    eventType, message, meta),
  security: (eventType, message, meta) => log('security', eventType, message, meta),

  /**
   * Returnează un logger cu contextul HTTP pre-populat din obiectul req.
   * Folosire: logger.fromReq(req).audit('BID_CREATED', 'Bid submitted', { amount })
   */
  fromReq(req) {
    const ctx = {
      requestId: req.requestId,
      userId:    req.user?.id   || req.user?._id,
      userRole:  req.user?.role,
      method:    req.method,
      route:     req.originalUrl || req.url,
      ip:        extractIp(req),
      userAgent: req.headers?.['user-agent']?.slice(0, 150),
    };

    return {
      debug:    (et, msg, meta) => log('debug',    et, msg, { ...ctx, ...meta }),
      info:     (et, msg, meta) => log('info',     et, msg, { ...ctx, ...meta }),
      warn:     (et, msg, meta) => log('warn',     et, msg, { ...ctx, ...meta }),
      error:    (et, msg, meta) => log('error',    et, msg, { ...ctx, ...meta }),
      audit:    (et, msg, meta) => log('audit',    et, msg, { ...ctx, ...meta }),
      security: (et, msg, meta) => log('security', et, msg, { ...ctx, ...meta }),
    };
  },

  /**
   * Loghează un obiect Error complet.
   * Nu expune stack trace în producție.
   */
  logError(eventType, err, meta = {}) {
    log('error', eventType, err.message, {
      ...meta,
      errorName:    err.name,
      errorMessage: err.message,
      stack:        err.stack,
    });
  },

  /**
   * Loghează o eroare din contextul unui request.
   */
  logReqError(req, eventType, err, meta = {}) {
    const ctx = {
      requestId: req.requestId,
      userId:    req.user?.id   || req.user?._id,
      userRole:  req.user?.role,
      method:    req.method,
      route:     req.originalUrl || req.url,
      ip:        extractIp(req),
    };
    log('error', eventType, err.message, {
      ...ctx,
      ...meta,
      errorName:    err.name,
      errorMessage: err.message,
      stack:        err.stack,
    });
  },
};

/* ─── Helpers ────────────────────────────────────────────────── */
function extractIp(req) {
  return (
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

module.exports = logger;
