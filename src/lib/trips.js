'use strict';
const crypto = require('crypto');
const { CsvTable } = require('./csvtable');
const { tripDays, formatRange } = require('./dates');

const COLUMNS = ['id', 'title', 'destination', 'start_date', 'end_date', 'price', 'blurb', 'description', 'images', 'created_at'];
const IMAGE_SEP = '|';

/** CSV-backed trip store (see CsvTable for the locking / atomic-write guarantees). */
class TripStore extends CsvTable {
  constructor(file) {
    super(file, COLUMNS);
  }

  async _read() {
    const rows = await this._readRows();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      destination: r.destination,
      start_date: r.start_date,
      end_date: r.end_date,
      price: Number(r.price) || 0,
      blurb: r.blurb,
      description: r.description,
      images: r.images ? r.images.split(IMAGE_SEP).filter(Boolean) : [],
      created_at: r.created_at,
    }));
  }

  _write(trips) {
    return this._writeRows(trips.map((t) => ({ ...t, images: (t.images || []).join(IMAGE_SEP) })));
  }

  all() { return this._enqueue(() => this._read()); }

  async get(id) { return (await this.all()).find((t) => t.id === id) || null; }

  add(input) {
    return this._enqueue(async () => {
      const trip = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input };
      const trips = await this._read();
      trips.push(trip);
      await this._write(trips);
      return trip;
    });
  }

  /** Removes a trip row; resolves with the removed trip (or null). */
  remove(id) {
    return this._enqueue(async () => {
      const trips = await this._read();
      const idx = trips.findIndex((t) => t.id === id);
      if (idx === -1) return null;
      const [removed] = trips.splice(idx, 1);
      await this._write(trips);
      return removed;
    });
  }

  /** Upcoming = starts today or later. Soonest first. */
  async upcoming(today) {
    return (await this.all())
      .filter((t) => t.start_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title));
  }
}

const priceFmt = new Intl.NumberFormat('en-IN');

/** Adds display-ready fields used by the templates. */
function presentTrip(t) {
  const days = tripDays(t.start_date, t.end_date);
  return {
    ...t,
    cover: t.images[0] || '/img/placeholder.svg',
    dateRange: formatRange(t.start_date, t.end_date),
    days,
    duration: days === 1 ? '1 day' : `${days} days`,
    priceText: `₹${priceFmt.format(t.price)}`,
    paragraphs: String(t.description || '').split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean),
  };
}

module.exports = { TripStore, presentTrip, COLUMNS };
