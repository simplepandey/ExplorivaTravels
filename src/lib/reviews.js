'use strict';
const crypto = require('crypto');
const { CsvTable } = require('./csvtable');

const COLUMNS = ['id', 'name', 'trip', 'rating', 'text', 'status', 'created_at'];
const LIMITS = { name: 60, trip: 120, text: 1000 };
const MIN_TEXT = 10;

/** Validates a public review submission. Returns { values, errors }. */
function validateReview(body = {}) {
  const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
  const values = { name: clean(body.name), trip: clean(body.trip), rating: clean(body.rating), text: typeof body.text === 'string' ? body.text.trim() : '' };
  const errors = {};
  if (!values.name) errors.name = 'Please tell us your name.';
  else if (values.name.length > LIMITS.name) errors.name = `Name must be ${LIMITS.name} characters or fewer.`;
  if (values.trip.length > LIMITS.trip) errors.trip = `Trip must be ${LIMITS.trip} characters or fewer.`;
  if (!/^[1-5]$/.test(values.rating)) errors.rating = 'Choose a rating from 1 to 5.';
  if (values.text.length < MIN_TEXT) errors.text = `Please write at least ${MIN_TEXT} characters.`;
  else if (values.text.length > LIMITS.text) errors.text = `Review must be ${LIMITS.text} characters or fewer.`;
  return { values, errors };
}

class ReviewStore extends CsvTable {
  constructor(file) {
    super(file, COLUMNS);
  }

  async _read() {
    return (await this._readRows()).map((r) => ({ ...r, rating: Number(r.rating) || 0 }));
  }

  all() { return this._enqueue(() => this._read()); }

  /** New reviews always start as "pending"; only an admin can approve them. */
  add({ name, trip, rating, text }) {
    return this._enqueue(async () => {
      const review = { id: crypto.randomUUID(), name, trip, rating: Number(rating), text, status: 'pending', created_at: new Date().toISOString() };
      const rows = await this._read();
      rows.push(review);
      await this._writeRows(rows);
      return review;
    });
  }

  approve(id) {
    return this._enqueue(async () => {
      const rows = await this._read();
      const r = rows.find((x) => x.id === id);
      if (!r) return null;
      r.status = 'approved';
      await this._writeRows(rows);
      return r;
    });
  }

  remove(id) {
    return this._enqueue(async () => {
      const rows = await this._read();
      const i = rows.findIndex((x) => x.id === id);
      if (i === -1) return null;
      const [removed] = rows.splice(i, 1);
      await this._writeRows(rows);
      return removed;
    });
  }

  async approved() {
    return (await this.all()).filter((r) => r.status === 'approved').sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

module.exports = { ReviewStore, validateReview, LIMITS };
