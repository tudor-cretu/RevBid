'use strict';

/**
 * RevBid — Constante Event Types
 * ─────────────────────────────────────────────────────────────────
 * Toate event type-urile folosite în logging, grupate pe domeniu.
 * Folosiți întotdeauna aceste constante — nu strings hardcodate.
 */

const EVENTS = {

  /* ── Autentificare & Cont ── */
  AUTH: {
    REGISTER_SUCCESS:      'AUTH_REGISTER_SUCCESS',
    REGISTER_FAILED:       'AUTH_REGISTER_FAILED',
    EMAIL_VERIFY_SUCCESS:  'AUTH_EMAIL_VERIFY_SUCCESS',
    EMAIL_VERIFY_FAILED:   'AUTH_EMAIL_VERIFY_FAILED',
    RESEND_CODE:           'AUTH_RESEND_CODE',
    LOGIN_SUCCESS:         'AUTH_LOGIN_SUCCESS',
    LOGIN_FAILED:          'AUTH_LOGIN_FAILED',
    LOGIN_BANNED:          'AUTH_LOGIN_BANNED',
    GOOGLE_LOGIN:          'AUTH_GOOGLE_LOGIN',
    LOGOUT:                'AUTH_LOGOUT',
    TOKEN_MISSING:         'AUTH_TOKEN_MISSING',
    TOKEN_INVALID:         'AUTH_TOKEN_INVALID',
    TOKEN_EXPIRED:         'AUTH_TOKEN_EXPIRED',
    PASSWORD_CHANGED:      'AUTH_PASSWORD_CHANGED',
    PASSWORD_CHANGE_FAILED:'AUTH_PASSWORD_CHANGE_FAILED',
    PROFILE_UPDATED:       'AUTH_PROFILE_UPDATED',
    AVATAR_UPDATED:        'AUTH_AVATAR_UPDATED',
    ACCOUNT_DELETED:       'AUTH_ACCOUNT_DELETED',
  },

  /* ── Licitații ── */
  AUCTION: {
    CREATED:            'AUCTION_CREATED',
    UPDATED:            'AUCTION_UPDATED',
    CANCELLED:          'AUCTION_CANCELLED',
    CLOSED:             'AUCTION_CLOSED',
    CLOSED_AUTO:        'AUCTION_CLOSED_AUTO',
    DEADLINE_EXTENDED:  'AUCTION_DEADLINE_EXTENDED',
    UNAUTHORIZED:       'AUCTION_UNAUTHORIZED',
    NOT_FOUND:          'AUCTION_NOT_FOUND',
    FETCH:              'AUCTION_FETCH',
  },

  /* ── Oferte ── */
  BID: {
    CREATED:            'BID_CREATED',
    REJECTED:           'BID_REJECTED',
    UNAUTHORIZED:       'BID_UNAUTHORIZED',
    INVALID_AMOUNT:     'BID_INVALID_AMOUNT',
    WINNING:            'BID_WINNING',
  },

  /* ── Upload ── */
  UPLOAD: {
    SUCCESS:            'UPLOAD_SUCCESS',
    FAILED:             'UPLOAD_FAILED',
    UNAUTHORIZED:       'UPLOAD_UNAUTHORIZED',
    IMAGE_DELETED:      'UPLOAD_IMAGE_DELETED',
    DELETE_FAILED:      'UPLOAD_DELETE_FAILED',
    NO_FILES:           'UPLOAD_NO_FILES',
  },

  /* ── Admin ── */
  ADMIN: {
    USER_BANNED:        'ADMIN_USER_BANNED',
    USER_UNBANNED:      'ADMIN_USER_UNBANNED',
    AUCTION_CLOSED:     'ADMIN_AUCTION_CLOSED',
    LIST_USERS:         'ADMIN_LIST_USERS',
    LIST_AUCTIONS:      'ADMIN_LIST_AUCTIONS',
    ACCESS_DENIED:      'ADMIN_ACCESS_DENIED',
  },

  /* ── Socket / Real-time ── */
  SOCKET: {
    CONNECTED:          'SOCKET_CONNECTED',
    DISCONNECTED:       'SOCKET_DISCONNECTED',
    JOIN_AUCTION:       'SOCKET_JOIN_AUCTION',
    LEAVE_AUCTION:      'SOCKET_LEAVE_AUCTION',
    AUTH_FAILED:        'SOCKET_AUTH_FAILED',
    BID_PLACED:         'SOCKET_BID_PLACED',
    BID_REJECTED:       'SOCKET_BID_REJECTED',
  },

  /* ── Sistem ── */
  SYSTEM: {
    SERVER_START:       'SYSTEM_SERVER_START',
    DB_CONNECTED:       'SYSTEM_DB_CONNECTED',
    DB_ERROR:           'SYSTEM_DB_ERROR',
    JOB_STARTED:        'SYSTEM_JOB_STARTED',
    UNHANDLED_ERROR:    'SYSTEM_UNHANDLED_ERROR',
    VALIDATION_ERROR:   'SYSTEM_VALIDATION_ERROR',
    NOT_FOUND:          'SYSTEM_NOT_FOUND',
  },

  /* ── HTTP ── */
  HTTP: {
    REQUEST:            'HTTP_REQUEST',
    RESPONSE:           'HTTP_RESPONSE',
    ERROR_4XX:          'HTTP_ERROR_4XX',
    ERROR_5XX:          'HTTP_ERROR_5XX',
  },

};

module.exports = EVENTS;
