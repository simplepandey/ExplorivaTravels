'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeApp } = require('./helpers');
const config = require('../src/config');

const { email, phone } = config.contact;

test('config exposes the exact contact details', () => {
  assert.equal(config.contact.email, 'explorivatravels@gmail.com');
  assert.equal(config.contact.phone, '+91 80971 94290');
  assert.equal(config.contact.whatsapp, '918097194290');
  assert.equal(config.contact.phoneHref, 'tel:+918097194290');
  assert.equal(config.contact.whatsappHref, 'https://wa.me/918097194290');
});

test('footer shows the email (mailto:) and phone (tel:) on every public page', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  for (const p of ['/', '/trips', '/about', '/contact']) {
    const res = await request(app).get(p).expect(200);
    const footer = res.text.slice(res.text.indexOf('<footer'));
    assert.ok(footer.includes(`href="mailto:${email}"`), `${p} footer mailto`);
    assert.ok(footer.includes(`>${email}</a>`), `${p} footer email text`);
    assert.ok(footer.includes('href="tel:+918097194290"'), `${p} footer tel`);
    assert.ok(footer.includes(`>${phone}</a>`), `${p} footer phone text`);
  }
});

test('Contact page shows the email, phone and WhatsApp link', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const res = await request(app).get('/contact').expect(200);
  const main = res.text.slice(res.text.indexOf('<main'), res.text.indexOf('</main>'));
  assert.ok(main.includes(`href="mailto:${email}"`));
  assert.ok(main.includes(email));
  assert.ok(main.includes('href="tel:+918097194290"'));
  assert.ok(main.includes(phone));
  assert.ok(main.includes('https://wa.me/918097194290'));
});

test('brand name appears in titles, header, footer and Open Graph tags', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  for (const p of ['/', '/trips', '/about', '/contact']) {
    const res = await request(app).get(p).expect(200);
    assert.match(res.text, /<title>[^<]*Exploriva Travels[^<]*<\/title>/, p);
    assert.match(res.text, /property="og:site_name" content="Exploriva Travels"/, p);
    assert.match(res.text, /aria-label="Exploriva Travels home"/, p);
  }
});

test('sitemap and robots.txt only list public pages', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const sm = await request(app).get('/sitemap.xml').expect(200);
  const rb = await request(app).get('/robots.txt').expect(200);
  for (const body of [sm.text, rb.text]) assert.doesNotMatch(body, /login|admin/i);
});

test('security headers: CSP present, cache disabled on login', async (t) => {
  const { app, cleanup } = await makeApp();
  t.after(cleanup);
  const res = await request(app).get('/login');
  assert.match(res.headers['content-security-policy'], /default-src 'self'/);
  assert.match(res.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(res.headers['cache-control'], /no-store/);
});
