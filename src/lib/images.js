'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MIN_IMAGES, MAX_IMAGES, MAX_IMAGE_BYTES } = require('./validate');

// Real content types we accept -> the extension WE choose for the stored file.
const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const UPLOAD_URL_PREFIX = '/uploads/';
const STORED_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

let fileTypeMod;
async function detect(buffer) {
  fileTypeMod ||= await import('file-type'); // ESM-only package
  const ft = await fileTypeMod.fileTypeFromBuffer(buffer);
  return ft && ALLOWED[ft.mime] ? { mime: ft.mime, ext: ALLOWED[ft.mime] } : null;
}

/**
 * Checks the uploaded files by magic bytes (not filename / client mimetype).
 * Returns { error, detected } where detected[i] = { ext } for each file.
 */
async function checkUploads(files = []) {
  if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
    return { error: `Upload between ${MIN_IMAGES} and ${MAX_IMAGES} images (you chose ${files.length}).` };
  }
  const detected = [];
  for (const f of files) {
    const name = String(f.originalname || 'file').slice(0, 60);
    if (f.size > MAX_IMAGE_BYTES) return { error: `"${name}" is larger than 5 MB.` };
    const d = await detect(f.buffer);
    if (!d) return { error: `"${name}" is not a valid JPG, PNG or WebP image.` };
    detected.push(d);
  }
  return { detected };
}

/** Writes files under random UUID names. Returns public URL paths. Cleans up on failure. */
async function saveUploads(files, detected, uploadsDir) {
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const written = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const name = `${crypto.randomUUID()}.${detected[i].ext}`;
      await fs.promises.writeFile(path.join(uploadsDir, name), files[i].buffer, { flag: 'wx' });
      written.push(name);
    }
  } catch (e) {
    await Promise.all(written.map((n) => fs.promises.rm(path.join(uploadsDir, n), { force: true })));
    throw e;
  }
  return written.map((n) => UPLOAD_URL_PREFIX + n);
}

/** Deletes uploaded files belonging to a trip. Seed/placeholder images (/img/...) are left alone. */
async function deleteUploads(urls, uploadsDir) {
  await Promise.all(
    urls
      .filter((u) => u.startsWith(UPLOAD_URL_PREFIX) && STORED_NAME.test(u.slice(UPLOAD_URL_PREFIX.length)))
      .map((u) => fs.promises.rm(path.join(uploadsDir, u.slice(UPLOAD_URL_PREFIX.length)), { force: true }))
  );
}

module.exports = { checkUploads, saveUploads, deleteUploads };
