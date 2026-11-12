'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateReview } = require('../lib/reviews');
const { presentTrip } = require('../lib/trips');
const { todayISO } = require('../lib/dates');

module.exports = function publicRoutes({ config, store, reviews, csrf }) {
  const router = express.Router();
  const today = () => todayISO(config.timezone);
  const upcoming = async () => (await store.upcoming(today())).map(presentTrip);

  router.get('/', async (req, res) => {
    const trips = (await upcoming()).slice(0, 4);
    const topReviews = (await reviews.approved()).slice(0, 3);
    res.render('home', { title: `${config.brand} | Women's group trips`, trips, topReviews, ogImage: trips[0] && trips[0].cover });
  });

  router.get('/trips', async (req, res) => {
    res.render('trips', {
      title: `Upcoming trips | ${config.brand}`,
      description: `Browse upcoming women-only group trips from ${config.brand}.`,
      trips: await upcoming(),
    });
  });

  router.get('/trips/:id', async (req, res, next) => {
    const raw = await store.get(req.params.id);
    if (!raw || raw.start_date < today()) return next(); // unknown or already departed -> 404
    const trip = presentTrip(raw);
    const message = `Hi ${config.brand}! I'd like to know more about "${trip.title}" (${trip.dateRange}).`;
    res.render('trip', {
      title: `${trip.title} | ${config.brand}`,
      description: trip.blurb,
      ogImage: trip.cover,
      trip,
      whatsappLink: `${config.contact.whatsappHref}?text=${encodeURIComponent(message)}`,
    });
  });

  async function renderReviews(req, res, { status = 200, values = {}, errors = {}, submitted = false } = {}) {
    const list = await reviews.approved();
    const average = list.length ? list.reduce((n, r) => n + r.rating, 0) / list.length : 0;
    res.status(status).render('reviews', {
      title: `Reviews | ${config.brand}`,
      description: `What travellers say about trips with ${config.brand}.`,
      reviews: list, average: Math.round(average * 10) / 10, values, errors, submitted, csrfToken: csrf.token(req, res),
    });
  }

  // Public submissions: rate limited per IP, and always held as "pending" until an admin approves.
  const reviewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (req, res) => res.status(429).render('error', { title: 'Slow down', heading: 'Too many submissions', message: 'Please try again in a little while.' }),
  });

  router.get('/reviews', (req, res) => renderReviews(req, res, { submitted: req.query.submitted === '1' }));
  router.post('/reviews', reviewLimiter, csrf.protect, async (req, res) => {
    if (req.body && req.body.website) return res.redirect(303, '/reviews?submitted=1'); // honeypot: bots fill hidden fields
    const { values, errors } = validateReview(req.body);
    if (Object.keys(errors).length) return renderReviews(req, res, { status: 422, values, errors });
    await reviews.add(values);
    res.redirect(303, '/reviews?submitted=1');
  });

  router.get('/about', (req, res) =>
    res.render('about', { title: `About us | ${config.brand}`, description: `Why ${config.brand} exists and how we plan our trips.` })
  );
  router.get('/contact', (req, res) =>
    res.render('contact', { title: `Contact | ${config.brand}`, description: `Get in touch with ${config.brand} by WhatsApp, phone or email.` })
  );

  // The sitemap and robots.txt deliberately mention only public pages.
  router.get('/sitemap.xml', async (req, res) => {
    const urls = ['/', '/trips', '/reviews', '/about', '/contact', ...(await upcoming()).map((t) => `/trips/${t.id}`)];
    const body = urls.map((u) => `  <url><loc>${config.siteUrl}${u}</loc></url>`).join('\n');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  });
  router.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`));

  return router;
};
