'use strict';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a strict YYYY-MM-DD string to a UTC Date, or null if malformed / not a real day. */
function parseISO(s) {
  const m = RE.exec(typeof s === 'string' ? s : '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Today's date as YYYY-MM-DD in the given IANA timezone. */
function todayISO(timeZone = 'Asia/Kolkata', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Inclusive number of days of a trip (start == end -> 1 day). */
function tripDays(start, end) {
  const a = parseISO(start), b = parseISO(end);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

function addDaysISO(iso, n) {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatRange(start, end) {
  const a = parseISO(start), b = parseISO(end);
  if (!a || !b) return '';
  const [da, ma, ya] = [a.getUTCDate(), MONTHS[a.getUTCMonth()], a.getUTCFullYear()];
  const [db, mb, yb] = [b.getUTCDate(), MONTHS[b.getUTCMonth()], b.getUTCFullYear()];
  if (start === end) return `${da} ${ma} ${ya}`;
  if (ya !== yb) return `${da} ${ma} ${ya} – ${db} ${mb} ${yb}`;
  if (ma !== mb) return `${da} ${ma} – ${db} ${mb} ${yb}`;
  return `${da}–${db} ${ma} ${yb}`;
}

module.exports = { parseISO, todayISO, tripDays, addDaysISO, formatRange };
