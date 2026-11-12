'use strict';
// Writes 4 sample future trips to data/trips.csv (dates are relative to today).
// WARNING: replaces the current trips file. Usage: node scripts/seed.js [--force]
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const { TripStore } = require('../src/lib/trips');
const { todayISO, addDaysISO } = require('../src/lib/dates');

const file = path.join(config.paths.data, 'trips.csv');
const hasRows = fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim().split('\n').length > 1;
if (hasRows && !process.argv.includes('--force')) {
  console.error(`${file} already has trips. Re-run with --force to replace them.`);
  process.exit(1);
}
fs.rmSync(file, { force: true });

const imgs = (n) => [1, 2, 3, 4].map((i) => `/img/trips/${n}-${i}.svg`);
const today = todayISO(config.timezone);
const samples = [
  {
    offset: 45, days: 6, price: 38500, images: imgs('rajasthan'),
    title: 'Rajasthan Heritage Circle', destination: 'Jaipur & Udaipur, Rajasthan',
    blurb: 'Palaces, bazaars and sunset rooftops with a small group of women.',
    description: 'Six days across Jaipur and Udaipur, with fort visits, a block-printing workshop, a lakeside dinner and plenty of time to wander the markets.\n\nStays are in heritage guesthouses in the old city. Breakfast daily, airport transfers and local guides are included.',
  },
  {
    offset: 80, days: 5, price: 32000, images: imgs('kerala'),
    title: 'Kerala Backwaters & Beaches', destination: 'Alleppey & Varkala, Kerala',
    blurb: 'Houseboat mornings, cliffside yoga and slow, sunny days.',
    description: 'Drift through the backwaters on a private houseboat, spend two nights by the sea in Varkala and finish with a Kerala cooking class.\n\nMost meals are included. The pace is relaxed: this trip is about unwinding.',
  },
  {
    offset: 215, days: 8, price: 46500, images: imgs('spiti'),
    title: 'Spiti Valley Road Trip', destination: 'Spiti Valley, Himachal Pradesh',
    blurb: 'High-altitude monasteries, starry skies and a women-led road trip.',
    description: 'Eight days through one of India\'s most dramatic landscapes: Kaza, Key Monastery, Chandratal and the highest villages on the route.\n\nWe travel in comfortable SUVs with an experienced driver, stay in cosy homestays and build in acclimatisation days. Moderate fitness recommended.',
  },
  {
    offset: 170, days: 7, price: 69000, images: imgs('bali'),
    title: 'Bali Wellness Escape', destination: 'Ubud & Uluwatu, Bali',
    blurb: 'Rice terraces, spa days and sunset swims, with time to just be.',
    description: 'Seven days split between Ubud\'s rice terraces and Uluwatu\'s clifftop beaches. Expect daily yoga, a traditional spa afternoon, a temple visit and a sunset group dinner.\n\nFlights are not included. Airport transfers, stays and most meals are.',
  },
];

(async () => {
  const store = await new TripStore(file).init();
  for (const s of samples) {
    const start = addDaysISO(today, s.offset);
    await store.add({
      title: s.title, destination: s.destination, start_date: start, end_date: addDaysISO(start, s.days - 1),
      price: s.price, blurb: s.blurb, description: s.description, images: s.images,
    });
  }
  console.log(`Seeded ${samples.length} trips into ${file}`);
})();
