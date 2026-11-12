'use strict';
const express = require('express');
const multer = require('multer');
const { presentTrip } = require('../lib/trips');
const { todayISO } = require('../lib/dates');
const { validateTripFields, MAX_IMAGE_BYTES, MAX_IMAGES } = require('../lib/validate');
const { checkUploads, saveUploads, deleteUploads } = require('../lib/images');

module.exports = function adminRoutes({ config, store, reviews, csrf }) {
  const router = express.Router();
  const today = () => todayISO(config.timezone);

  // Gate: only a valid server-side session gets in. Everyone else sees the same plain 404
  // as any unknown URL, so /admin and /login can't be discovered by probing.
  router.use((req, res, next) => {
    const s = req.session;
    const fresh = s && s.isAdmin && Date.now() - (s.lastSeen || 0) < config.idleTimeoutMs;
    if (!fresh) {
      if (s && s.isAdmin) return s.destroy(() => res.status(404).render('404', { title: 'Page not found' }));
      return res.status(404).render('404', { title: 'Page not found' });
    }
    s.lastSeen = Date.now();
    next();
  });

  const upload = multer({
    storage: multer.memoryStorage(), // nothing touches disk until validation passes
    limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES, fields: 20, parts: 40 },
  }).array('images', MAX_IMAGES);

  const handleUpload = (req, res, next) =>
    upload(req, res, (err) => {
      if (err) {
        req.files = [];
        req.uploadError =
          err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5 MB or smaller.'
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Upload between 2 and 10 images.'
          : 'The upload could not be read. Please try again.';
      }
      next();
    });

  async function renderForm(req, res, { status = 200, values = {}, errors = {} } = {}) {
    const flash = req.session.flash || null;
    delete req.session.flash;
    const trips = (await store.all()).sort((a, b) => a.start_date.localeCompare(b.start_date)).map(presentTrip);
    res.status(status).render('admin/trips', {
      title: 'Admin · Trips', noindex: true, csrfToken: csrf.token(req, res),
      trips, values, errors, flash, today: today(), todayStr: today(),
    });
  }

  router.get('/', (req, res) => res.redirect('/admin/trips/new'));
  router.get('/trips/new', (req, res) => renderForm(req, res));

  router.post('/trips', handleUpload, csrf.protect, async (req, res) => {
    const { values, errors, price } = validateTripFields(req.body, today());
    let detected;
    if (req.uploadError) errors.images = req.uploadError;
    else {
      const check = await checkUploads(req.files);
      if (check.error) errors.images = check.error;
      else detected = check.detected;
    }
    if (Object.keys(errors).length) return renderForm(req, res, { status: 422, values, errors });

    const images = await saveUploads(req.files, detected, config.paths.uploads);
    try {
      await store.add({ ...values, price, images });
    } catch (e) {
      await deleteUploads(images, config.paths.uploads);
      throw e;
    }
    req.session.flash = { type: 'success', text: `"${values.title}" was added.` };
    res.redirect(303, '/admin/trips/new');
  });

  router.post('/trips/:id/delete', csrf.protect, async (req, res) => {
    const removed = await store.remove(req.params.id);
    if (removed) await deleteUploads(removed.images, config.paths.uploads);
    req.session.flash = removed
      ? { type: 'success', text: `"${removed.title}" was deleted.` }
      : { type: 'error', text: 'That trip no longer exists.' };
    res.redirect(303, '/admin/trips/new');
  });

  router.get('/reviews', async (req, res) => {
    const flash = req.session.flash || null;
    delete req.session.flash;
    const all = (await reviews.all()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.render('admin/reviews', {
      title: 'Admin · Reviews', noindex: true, csrfToken: csrf.token(req, res), flash,
      pending: all.filter((r) => r.status !== 'approved'), approved: all.filter((r) => r.status === 'approved'),
    });
  });

  router.post('/reviews/:id/approve', csrf.protect, async (req, res) => {
    const r = await reviews.approve(req.params.id);
    req.session.flash = r ? { type: 'success', text: `Review by ${r.name} is now public.` } : { type: 'error', text: 'That review no longer exists.' };
    res.redirect(303, '/admin/reviews');
  });

  router.post('/reviews/:id/delete', csrf.protect, async (req, res) => {
    const r = await reviews.remove(req.params.id);
    req.session.flash = r ? { type: 'success', text: `Review by ${r.name} was deleted.` } : { type: 'error', text: 'That review no longer exists.' };
    res.redirect(303, '/admin/reviews');
  });

  router.post('/logout', csrf.protect, (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('exp.sid');
      res.set('Cache-Control', 'no-store').redirect(303, '/');
    });
  });

  return router;
};
