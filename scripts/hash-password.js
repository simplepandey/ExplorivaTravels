'use strict';
// Generates a bcrypt (cost 12) hash for the admin password.
//   node scripts/hash-password.js            (prompts, input hidden)
//   printf '%s' "$PW" | node scripts/hash-password.js   (non-interactive)
// Copy the printed value into .env as ADMIN_PASSWORD_HASH. Nothing is stored here.
const bcrypt = require('bcryptjs');

const COST = 12;

function readPassword() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => (data += c));
      process.stdin.on('end', () => resolve(data.replace(/\r?\n$/, '')));
      process.stdin.on('error', reject);
      return;
    }
    process.stdout.write('New admin password: ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let pw = '';
    process.stdin.on('data', function onData(ch) {
      for (const c of ch) {
        if (c === '\r' || c === '\n' || c === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(pw);
        }
        if (c === '\u0003') process.exit(130);
        if (c === '\u007f') pw = pw.slice(0, -1);
        else pw += c;
      }
    });
  });
}

readPassword().then(async (pw) => {
  if (pw.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  console.log(`ADMIN_PASSWORD_HASH=${await bcrypt.hash(pw, COST)}`);
});
