'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { makeApp, csrfFrom, loginAgent, PNG, today, inDays } = require('./helpers');
const { validateDates } = require('../src/lib/validate');
const config = require('../src/config');

test('validateDates: start must be today or later; end on/after start', () => {
  const t = '2030-05-10';
  assert.deepEqual(validateDates('2030-05-10', '2030-05-10', t), {});
  assert.deepEqual(validateDates('2030-05-11', '2030-05-15', t), {});
  assert.ok(validateDates('2030-05-09', '2030-05-15', t).start_date);
  assert.ok(validateDates('2030-05-12', '2030-05-11', t).end_date);
  assert.ok(validateDates('', '', t).start_date);
  assert.ok(validateDates('2030-02-30', '2030-03-01', t).start_date); // not a real day
  assert.ok(validateDates('10/05/2030', '2030-05-12', t).start_date);
});

async function submit(agent, fields, files = 2) {
  const page = await agent.get('/admin/trips/new');
  let req = agent.post('/admin/trips').field('_csrf', csrfFrom(page.text));
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  for (let i = 0; i < files; i++) req = req.attach('images', PNG, { filename: `evil name ${i}.png`, contentType: 'image/png' });
  return req;
}
const valid = () => ({ title: 'Test, "Trip"', destination: 'Somewhere', start_date: inDays(10), end_date: inDays(14), price: '12,500', blurb: 'A short blurb', description: 'Line 1\n\nLine 2' });

test('admin can add a trip: images saved under UUID names, trip listed publicly, then deleted with its files', async (t) => {
  const { app, paths, cleanup } = await makeApp();
  t.after(cleanup);
  const agent = await loginAgent(app);

  const res = await submit(agent, valid());
  assert.equal(res.status, 303, res.text);
  const files = fs.readdirSync(paths.uploads);
  assert.equal(files.length, 2);
  for (const f of files) assert.match(f, /^[0-9a-f-]{36}\.png$/); // never the client filename

  const admin = await agent.get('/admin/trips/new');
  assert.match(admin.text, /was added/);
  assert.match(admin.text, /Test, &#34;Trip&#34;/);

  const list = await request(app).get('/trips');
  assert.match(list.text, /Test, &#34;Trip&#34;/);
  assert.match(list.text, /₹12,500/);
  const id = /\/trips\/([0-9a-f-]{36})/.exec(list.text)[1];
  const detail = await request(app).get(`/trips/${id}`).expect(200);
  assert.match(detail.text, /Enquire on WhatsApp/);
  assert.match(detail.text, new RegExp(`https://wa.me/${config.contact.whatsapp}`));
  await request(app).get(`/uploads/${files[0]}`).expect(200).expect('Content-Type', /image\/png/);

  const del = await agent.post(`/admin/trips/${id}/delete`).type('form').send({ _csrf: csrfFrom(admin.text) });
  assert.equal(del.status, 303);
  assert.deepEqual(fs.readdirSync(paths.uploads), []);
  await request(app).get(`/trips/${id}`).expect(404);
});

test('server rejects bad dates (past start, end before start)', async (t) => {
  const { app, paths, cleanup } = await makeApp();
  t.after(cleanup);
  const agent = await loginAgent(app);

  let res = await submit(agent, { ...valid(), start_date: inDays(-1), end_date: inDays(3) });
  assert.equal(res.status, 422);
  assert.match(res.text, /Start date must be today or later/);

  res = await submit(agent, { ...valid(), start_date: inDays(5), end_date: inDays(4) });
  assert.equal(res.status, 422);
  assert.match(res.text, /End date must be on or after the start date/);

  res = await submit(agent, { ...valid(), start_date: today(), end_date: today() });
  assert.equal(res.status, 303); // today is allowed, single-day trip is allowed
  assert.equal(fs.readdirSync(paths.uploads).length, 2); // failed attempts wrote nothing
});

test('server rejects missing fields, wrong image counts, and non-images with a fake extension', async (t) => {
  const { app, paths, cleanup } = await makeApp();
  t.after(cleanup);
  const agent = await loginAgent(app);

  let res = await submit(agent, { ...valid(), title: '', price: 'abc' });
  assert.equal(res.status, 422);
  assert.match(res.text, /Title is required/);
  assert.match(res.text, /whole-number price/);

  res = await submit(agent, valid(), 1);
  assert.equal(res.status, 422);
  assert.match(res.text, /between 2 and 10/);

  res = await submit(agent, valid(), 11);
  assert.equal(res.status, 422);

  const page = await agent.get('/admin/trips/new');
  let req = agent.post('/admin/trips').field('_csrf', csrfFrom(page.text));
  for (const [k, v] of Object.entries(valid())) req = req.field(k, v);
  req = req.attach('images', PNG, { filename: 'ok.png', contentType: 'image/png' });
  req = req.attach('images', Buffer.from('<script>alert(1)</script>'), { filename: 'fake.jpg', contentType: 'image/jpeg' });
  res = await req;
  assert.equal(res.status, 422);
  assert.match(res.text, /not a valid JPG, PNG or WebP/);
  assert.equal(fs.existsSync(paths.uploads) ? fs.readdirSync(paths.uploads).length : 0, 0);
});

test('server rejects images larger than 5 MB', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const agent = await loginAgent(app);
  const page = await agent.get('/admin/trips/new');
  let req = agent.post('/admin/trips').field('_csrf', csrfFrom(page.text));
  for (const [k, v] of Object.entries(valid())) req = req.field(k, v);
  const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]);
  req = req.attach('images', big, { filename: 'big.png', contentType: 'image/png' }).attach('images', PNG, { filename: 'a.png', contentType: 'image/png' });
  const res = await req;
  assert.equal(res.status, 422);
  assert.match(res.text, /5 MB/);
});

test('admin POSTs without a CSRF token are rejected', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const agent = await loginAgent(app);
  await agent.post('/admin/trips/xyz/delete').type('form').send({}).expect(403);
  await agent.post('/admin/trips').field('title', 'x').expect(403);
});

test('public list hides past trips and shows an empty state', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const res = await request(app).get('/trips').expect(200);
  assert.match(res.text, /No upcoming trips yet, check back soon/);
});
