'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');

module.exports = function authRoutes({ config, verify, csrf }) {
  const router = express.Router();

  // 5 failed attempts per IP, then locked out for 15 minutes. Successful logins aren't counted.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).render('login', { title: 'Sign in', noindex: true, csrfToken: csrf.token(req, res), error: 'Too many failed attempts. Please try again in 15 minutes.' }),
  });

  router.get('/login', (req, res) => {
    if (req.session && req.session.isAdmin) return res.redirect('/admin/trips/new');
    res.render('login', { title: 'Sign in', noindex: true, csrfToken: csrf.token(req, res), error: null });
  });

  router.post('/login', loginLimiter, csrf.protect, async (req, res, next) => {
    const { username, password } = req.body || {};
    const ok = await verify(username, password);
    if (!ok) {
      return res.status(401).render('login', { title: 'Sign in', noindex: true, csrfToken: csrf.token(req, res), error: 'Invalid credentials' });
    }
    // New session id on privilege change (prevents session fixation).
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.isAdmin = true;
      req.session.lastSeen = Date.now();
      req.session.save((err2) => (err2 ? next(err2) : res.redirect(303, '/admin/trips/new')));
    });
  });

  return router;
};
