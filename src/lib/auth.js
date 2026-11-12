'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

/**
 * Builds a credential checker. A wrong username still runs a bcrypt compare
 * (against a throwaway hash of the same cost), so a wrong username and a wrong
 * password take about the same time.
 */
function createVerifier({ username, passwordHash }) {
  let rounds = 12;
  try { rounds = bcrypt.getRounds(passwordHash); } catch { /* no/invalid hash: login always fails */ }
  const dummyHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), rounds);
  const hasHash = /^\$2[aby]\$\d{2}\$.{53}$/.test(passwordHash || '');

  return async function verify(user, pass) {
    const userOk = safeEqual(typeof user === 'string' ? user : '', username);
    const passOk = await bcrypt.compare(typeof pass === 'string' ? pass : '', userOk && hasHash ? passwordHash : dummyHash);
    return userOk && passOk && hasHash;
  };
}

module.exports = { createVerifier };
