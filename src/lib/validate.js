'use strict';
const { parseISO } = require('./dates');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_IMAGES = 2;
const MAX_IMAGES = 10;
const LIMITS = { title: 120, destination: 120, blurb: 200, description: 5000 };

/** Validates the start/end dates. Returns a map of field -> message. */
function validateDates(start, end, today) {
  const errors = {};
  const s = parseISO(start), e = parseISO(end);
  if (!start) errors.start_date = 'Start date is required.';
  else if (!s) errors.start_date = 'Enter a valid start date.';
  else if (start < today) errors.start_date = 'Start date must be today or later.';

  if (!end) errors.end_date = 'End date is required.';
  else if (!e) errors.end_date = 'Enter a valid end date.';
  else if (s && end < start) errors.end_date = 'End date must be on or after the start date.';
  return errors;
}

/** Validates the text fields of the "add trip" form. */
function validateTripFields(body = {}, today) {
  const clean = (v) => (typeof v === 'string' ? v.trim() : '');
  const values = {
    title: clean(body.title),
    destination: clean(body.destination),
    start_date: clean(body.start_date),
    end_date: clean(body.end_date),
    price: clean(body.price),
    blurb: clean(body.blurb),
    description: clean(body.description),
  };
  const errors = {};

  for (const [f, label] of [['title', 'Title'], ['destination', 'Destination'], ['blurb', 'Short blurb'], ['description', 'Full description']]) {
    if (!values[f]) errors[f] = `${label} is required.`;
    else if (values[f].length > LIMITS[f]) errors[f] = `${label} must be ${LIMITS[f]} characters or fewer.`;
  }

  Object.assign(errors, validateDates(values.start_date, values.end_date, today));

  let price = null;
  if (!values.price) errors.price = 'Price is required.';
  else if (!/^\d[\d,]*$/.test(values.price) || Number(values.price.replace(/,/g, '')) < 1 || Number(values.price.replace(/,/g, '')) > 10000000) {
    errors.price = 'Enter a whole-number price between 1 and 10,000,000.';
  } else price = Number(values.price.replace(/,/g, ''));

  return { values, errors, price };
}

module.exports = { validateDates, validateTripFields, MAX_IMAGE_BYTES, MIN_IMAGES, MAX_IMAGES, LIMITS };
