'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeApp, csrfFrom, loginAgent } = require('./helpers');
const { validateReview } = require('../src/lib/reviews');

const good = { name: 'Asha, "A"', trip: 'Kerala', rating: '5', text: 'Wonderful trip,\nwith "great" company <b>x</b>' };

async function post(agent, fields) {
  const page = await agent.get('/reviews');
  return agent.post('/reviews').type('form').send({ _csrf: csrfFrom(page.text), ...fields });
}

test('validateReview checks name, rating and text', () => {
  assert.deepEqual(validateReview(good).errors, {});
  const { errors } = validateReview({ name: '', rating: '9', text: 'short' });
  assert.ok(errors.name && errors.rating && errors.text);
});

test('Reviews tab is in the nav, page shows empty state and the form', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const res = await request(app).get('/reviews').expect(200);
  assert.match(res.text, /<a href="\/reviews"[^>]*>Reviews<\/a>/);
  assert.match(res.text, /No reviews yet/);
  assert.match(res.text, /name="_csrf"/);
  assert.match((await request(app).get('/sitemap.xml')).text, /\/reviews/);
});

test('submitted reviews stay hidden until an admin approves them; text is escaped', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const visitor = request.agent(app);
  const res = await post(visitor, good);
  assert.equal(res.status, 303);
  assert.equal(res.headers.location, '/reviews?submitted=1');
  assert.match((await visitor.get('/reviews?submitted=1')).text, /will appear once we've approved/);
  assert.doesNotMatch((await request(app).get('/reviews')).text, /Wonderful trip/);
  assert.doesNotMatch((await request(app).get('/')).text, /What travellers say/);

  const admin = await loginAgent(app);
  const q = await admin.get('/admin/reviews').expect(200);
  assert.match(q.text, /Waiting for approval \(1\)/);
  const id = /\/admin\/reviews\/([0-9a-f-]{36})\/approve/.exec(q.text)[1];
  await admin.post(`/admin/reviews/${id}/approve`).type('form').send({ _csrf: csrfFrom(q.text) }).expect(303);

  const pub = await request(app).get('/reviews');
  assert.match(pub.text, /Wonderful trip/);
  assert.doesNotMatch(pub.text, /<b>x<\/b>/); // escaped
  assert.match(pub.text, /5 out of 5 stars/);
  assert.match((await request(app).get('/')).text, /What travellers say/);

  const list = await admin.get('/admin/reviews');
  await admin.post(`/admin/reviews/${id}/delete`).type('form').send({ _csrf: csrfFrom(list.text) }).expect(303);
  assert.doesNotMatch((await request(app).get('/reviews')).text, /Wonderful trip/);
});

test('invalid review is rejected with errors; honeypot and missing CSRF are not saved', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const v = request.agent(app);
  const bad = await post(v, { name: '', rating: '', text: 'x' });
  assert.equal(bad.status, 422);
  assert.match(bad.text, /Please tell us your name/);
  const bot = await post(v, { ...good, website: 'http://spam' });
  assert.equal(bot.status, 303);
  await request(app).post('/reviews').type('form').send(good).expect(403);

  const admin = await loginAgent(app);
  assert.match((await admin.get('/admin/reviews')).text, /Waiting for approval \(0\)/);
});

test('/admin/reviews and its actions are 404 when logged out', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  await request(app).get('/admin/reviews').expect(404);
  await request(app).post('/admin/reviews/x/approve').expect(404);
  await request(app).post('/admin/reviews/x/delete').expect(404);
});
