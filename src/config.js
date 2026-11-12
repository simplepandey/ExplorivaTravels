'use strict';
// Single source of truth for configuration. Everything else imports from here.
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ quiet: true });

const env = process.env;
const root = path.join(__dirname, '..');
const isProd = env.NODE_ENV === 'production';

function parseTrustProxy(v) {
  if (v === undefined || v === '') return isProd ? 1 : false;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return /^\d+$/.test(v) ? Number(v) : v;
}

const digits = (s) => String(s || '').replace(/\D/g, '');

const email = env.CONTACT_EMAIL || 'explorivatravels@gmail.com';
const phone = env.CONTACT_PHONE || '+91 80971 94290';
const whatsapp = digits(env.WHATSAPP_NUMBER || '918097194290');

let sessionSecret = env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProd) throw new Error('SESSION_SECRET must be set in production (see .env.example).');
  sessionSecret = crypto.randomBytes(32).toString('hex'); // dev only: sessions reset on restart
}

module.exports = {
  brand: 'Exploriva Travels',
  domain: 'explorivatravels.com',
  siteUrl: (env.SITE_URL || 'https://explorivatravels.com').replace(/\/+$/, ''),
  port: Number(env.PORT) || 3000,
  isProd,
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  timezone: env.TIMEZONE || 'Asia/Kolkata',
  contact: {
    email,
    phone,
    whatsapp,
    emailHref: `mailto:${email}`,
    phoneHref: `tel:+${digits(phone)}`,
    whatsappHref: `https://wa.me/${whatsapp}`,
  },
  admin: {
    username: 'admin',
    passwordHash: env.ADMIN_PASSWORD_HASH || '',
  },
  sessionSecret,
  csrfSecret: env.CSRF_SECRET || sessionSecret + ':csrf',
  idleTimeoutMs: 30 * 60 * 1000,
  paths: {
    root,
    public: path.join(root, 'public'),
    views: path.join(root, 'views'),
    data: env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(root, 'data'),
    uploads: env.UPLOADS_DIR ? path.resolve(env.UPLOADS_DIR) : path.join(root, 'uploads'),
    sessions: env.SESSIONS_DIR ? path.resolve(env.SESSIONS_DIR) : path.join(root, 'sessions'),
  },
};
