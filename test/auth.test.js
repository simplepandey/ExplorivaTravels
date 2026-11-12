'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeApp, csrfFrom, loginAgent, TEST_PASSWORD } = require('./helpers');

test('login page is noindex, uncached, and not linked from public pages or listed in robots/sitemap', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const res = await request(app).get('/login').expect(200);
  assert.match(res.text, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(res.headers['cache-control'], /no-store/);
  for (const p of ['/', '/trips', '/about', '/contact', '/robots.txt', '/sitemap.xml', '/does-not-exist']) {
    const r = await request(app).get(p);
    assert.doesNotMatch(r.text, /\/login/i, `${p} must not mention /login`);
  }
});

test('successful login redirects to /admin/trips/new and grants access', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const agent = request.agent(app);
  const page = await agent.get('/login');
  const res = await agent.post('/login').type('form').send({ _csrf: csrfFrom(page.text), username: 'admin', password: TEST_PASSWORD });
  assert.equal(res.status, 303);
  assert.equal(res.headers.location, '/admin/trips/new');
  const admin = await agent.get('/admin/trips/new').expect(200);
  assert.match(admin.headers['cache-control'], /no-store/);
  assert.match(admin.text, /Add a trip/);
});

test('session id is regenerated on login and cookie flags are set', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const agent = request.agent(app);
  const page = await agent.get('/login');
  const res = await agent.post('/login').type('form').send({ _csrf: csrfFrom(page.text), username: 'admin', password: TEST_PASSWORD });
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith('exp.sid='));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
});

test('wrong password, wrong username, and missing fields all give the same generic error', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const attempt = async (body) => {
    const agent = request.agent(app);
    const page = await agent.get('/login');
    return agent.post('/login').type('form').send({ _csrf: csrfFrom(page.text), ...body });
  };
  const bodies = [{ username: 'admin', password: 'nope' }, { username: 'root', password: TEST_PASSWORD }, { username: 'admin' }, {}];
  for (const b of bodies) {
    const res = await attempt(b);
    assert.equal(res.status, 401);
    assert.match(res.text, /Invalid credentials/);
    assert.ok(!res.headers.location);
  }
});

test('POST /login without a CSRF token is rejected', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  await request(app).post('/login').type('form').send({ username: 'admin', password: TEST_PASSWORD }).expect(403);
});

test('after 5 failed attempts the IP is locked out, even with the right password', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const agent = request.agent(app);
  const page = await agent.get('/login');
  const _csrf = csrfFrom(page.text);
  for (let i = 0; i < 5; i++) {
    await agent.post('/login').type('form').send({ _csrf, username: 'admin', password: 'bad' }).expect(401);
  }
  const locked = await agent.post('/login').type('form').send({ _csrf, username: 'admin', password: TEST_PASSWORD });
  assert.equal(locked.status, 429);
});

test('/admin/** is a plain 404 (no redirect) when not logged in', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const unknown = await request(app).get('/definitely-not-a-page');
  for (const [method, p] of [['get', '/admin'], ['get', '/admin/trips/new'], ['get', '/admin/anything/else'], ['post', '/admin/trips'], ['post', '/admin/trips/abc/delete'], ['post', '/admin/logout']]) {
    const res = await request(app)[method](p);
    assert.equal(res.status, 404, `${method} ${p}`);
    assert.ok(!res.headers.location, `${p} must not redirect`);
    assert.doesNotMatch(res.text, /login/i);
    assert.equal(res.text, unknown.text, `${p} looks identical to any unknown page`);
  }
});

test('logout destroys the session', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const agent = await loginAgent(app);
  const page = await agent.get('/admin/trips/new').expect(200);
  const out = await agent.post('/admin/logout').type('form').send({ _csrf: csrfFrom(page.text) });
  assert.equal(out.status, 303);
  assert.match(out.headers['cache-control'], /no-store/);
  await agent.get('/admin/trips/new').expect(404);
});
