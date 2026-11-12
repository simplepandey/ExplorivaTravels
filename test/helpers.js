'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const request = require('supertest');
const { createApp } = require('../src/app');
const { addDaysISO, todayISO } = require('../src/lib/dates');

const TEST_PASSWORD = 'test-password-123'; // test-only; unrelated to the real admin password
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function makeApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exploriva-test-'));
  const paths = { data: path.join(dir, 'data'), uploads: path.join(dir, 'uploads'), sessions: path.join(dir, 'sessions') };
  const app = await createApp({
    paths,
    admin: { username: 'admin', passwordHash: bcrypt.hashSync(TEST_PASSWORD, 4) },
    sessionStore: new session.MemoryStore(),
    sessionSecret: 'test-secret',
    csrfSecret: 'test-csrf-secret',
  });
  return { app, dir, paths, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const csrfFrom = (html) => (/name="_csrf" value="([^"]+)"/.exec(html) || [])[1];

/** Logs in with a fresh agent; returns the agent. */
async function loginAgent(app) {
  const agent = request.agent(app);
  const page = await agent.get('/login');
  await agent.post('/login').type('form').send({ _csrf: csrfFrom(page.text), username: 'admin', password: TEST_PASSWORD }).expect(303);
  return agent;
}

const today = () => todayISO('Asia/Kolkata');
const inDays = (n) => addDaysISO(today(), n);

module.exports = { makeApp, csrfFrom, loginAgent, TEST_PASSWORD, PNG, today, inDays };
