'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TripStore } = require('../src/lib/trips');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csv-')), 'trips.csv');

test('creates the file with a header row when missing', async () => {
  const file = tmp();
  await new TripStore(file).init();
  assert.match(fs.readFileSync(file, 'utf8'), /^id,title,destination,start_date,end_date,price,blurb,description,images,created_at\n?$/);
});

test('round-trips commas, quotes, newlines and unicode', async () => {
  const store = await new TripStore(tmp()).init();
  const description = 'Line one, with a comma\nLine two has "quotes" and ""double""\r\n\r\nParagraph, "three" — café ☕';
  const added = await store.add({
    title: 'Goa, "Sun & Sand"', destination: 'Goa, India', start_date: '2030-01-10', end_date: '2030-01-15',
    price: 25000, blurb: 'Fun, sun and "chill"', description, images: ['/uploads/a.jpg', '/uploads/b.png'],
  });
  const back = await store.get(added.id);
  assert.equal(back.title, 'Goa, "Sun & Sand"');
  assert.equal(back.description, description);
  assert.equal(back.blurb, 'Fun, sun and "chill"');
  assert.deepEqual(back.images, ['/uploads/a.jpg', '/uploads/b.png']);
  assert.equal(back.price, 25000);
});

test('concurrent adds are serialized and none are lost', async () => {
  const file = tmp();
  const store = await new TripStore(file).init();
  const mk = (i) => ({ title: `T${i}`, destination: 'D', start_date: '2030-01-01', end_date: '2030-01-02', price: i + 1, blurb: 'b', description: 'd', images: ['/x.jpg'] });
  await Promise.all(Array.from({ length: 25 }, (_, i) => store.add(mk(i))));
  assert.equal((await store.all()).length, 25);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['trips.csv']); // no temp files left behind
});

test('remove deletes the row and returns it', async () => {
  const store = await new TripStore(tmp()).init();
  const t = await store.add({ title: 'A', destination: 'D', start_date: '2030-01-01', end_date: '2030-01-02', price: 1, blurb: 'b', description: 'd', images: [] });
  assert.equal((await store.remove(t.id)).title, 'A');
  assert.equal((await store.all()).length, 0);
  assert.equal(await store.remove(t.id), null);
});

test('upcoming() filters past trips and sorts soonest first', async () => {
  const store = await new TripStore(tmp()).init();
  const base = { destination: 'D', price: 1, blurb: 'b', description: 'd', images: [] };
  await store.add({ ...base, title: 'late', start_date: '2030-06-01', end_date: '2030-06-02' });
  await store.add({ ...base, title: 'past', start_date: '2020-01-01', end_date: '2020-01-02' });
  await store.add({ ...base, title: 'soon', start_date: '2030-02-01', end_date: '2030-02-02' });
  assert.deepEqual((await store.upcoming('2029-12-31')).map((t) => t.title), ['soon', 'late']);
});
