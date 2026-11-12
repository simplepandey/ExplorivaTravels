'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');

const baseConfig = require('./config');
const { TripStore } = require('./lib/trips');
const { ReviewStore } = require('./lib/reviews');
const { createVerifier } = require('./lib/auth');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

/** Builds the Express app. `overrides` lets tests inject temp dirs, a hash, etc. */
async function createApp(overrides = {}) {
  const config = {
    ...baseConfig,
    ...overrides,
    admin: { ...baseConfig.admin, ...overrides.admin },
    paths: { ...baseConfig.paths, ...overrides.paths },
  };
  if (!config.admin.passwordHash) {
    console.warn('[warn] ADMIN_PASSWORD_HASH is not set - admin login is disabled. See README.');
  }

  const store = await new TripStore(path.join(config.paths.data, 'trips.csv')).init();
  const reviews = await new ReviewStore(path.join(config.paths.data, 'reviews.csv')).init();
  const verify = createVerifier(config.admin);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', config.paths.views);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.tailwindcss.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // Tailwind CDN injects a <style> tag
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
    })
  );

  // Static files first: no sessions / cookies for assets.
  const maxAge = config.isProd ? '7d' : 0;
  app.use(express.static(config.paths.public, { maxAge, index: false }));
  app.use('/uploads', express.static(config.paths.uploads, { maxAge: '30d', immutable: true, index: false, dotfiles: 'ignore' }));

  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(
    session({
      name: 'exp.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true, // idle timeout: every request extends the cookie
      store:
        config.sessionStore ||
        new FileStore({ path: config.paths.sessions, ttl: config.idleTimeoutMs / 1000, retries: 1, logFn: () => {} }),
      cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: 'auto', // secure whenever the request arrived over HTTPS (trust proxy aware)
        maxAge: config.idleTimeoutMs,
      },
    })
  );

  const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => config.csrfSecret,
    // The login session id changes on login (regeneration), so tokens are bound to
    // the HMAC secret + SameSite=Strict cookie rather than to a session id.
    getSessionIdentifier: () => 'exploriva',
    cookieName: 'exp.csrf',
    cookieOptions: { httpOnly: true, sameSite: 'strict', secure: false, path: '/' },
    getCsrfTokenFromRequest: (req) => (req.body && req.body._csrf) || req.headers['x-csrf-token'],
  });
  const csrf = {
    protect: doubleCsrfProtection,
    token: (req, res) => generateCsrfToken(req, res, { cookieOptions: { secure: req.secure } }),
  };

  // Admin + login pages must never be cached (back button after logout).
  app.use(['/admin', '/login'], (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache', 'X-Robots-Tag': 'noindex, nofollow' });
    next();
  });

  app.use((req, res, next) => {
    res.locals.brand = config.brand;
    res.locals.contact = config.contact;
    res.locals.siteUrl = config.siteUrl;
    res.locals.path = req.path;
    res.locals.noindex = false;
    res.locals.ogImage = null;
    res.locals.description = `${config.brand} runs small-group trips for women: thoughtfully planned, beautifully photographed, and shared with great company.`;
    next();
  });

  const ctx = { config, store, reviews, verify, csrf };
  app.use(publicRoutes(ctx));
  app.use(authRoutes(ctx));
  app.use('/admin', adminRoutes(ctx));

  app.use((req, res) => res.status(404).render('404', { title: 'Page not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
      return res.status(403).render('error', { title: 'Please try again', heading: 'That form expired', message: 'Please go back, refresh the page and try again.' });
    }
    if (err && err.type === 'entity.too.large') return res.status(413).render('error', { title: 'Too large', heading: 'Request too large', message: 'That request was too big.' });
    console.error(err);
    res.status(500).render('error', { title: 'Something went wrong', heading: 'Something went wrong', message: 'Please try again in a moment.' });
  });

  return app;
}

module.exports = { createApp };
