'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

/**
 * Base class for the CSV-backed stores. All operations go through one promise
 * queue so read-modify-write cycles never interleave, and every write is atomic
 * (temp file in the same directory, then rename).
 */
class CsvTable {
  constructor(file, columns) {
    this.file = file;
    this.columns = columns;
    this._queue = Promise.resolve();
  }

  _enqueue(fn) {
    const run = this._queue.then(fn);
    this._queue = run.catch(() => {}); // keep the chain alive after a failure
    return run;
  }

  async init() {
    await this._enqueue(async () => {
      await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
      if (!fs.existsSync(this.file)) await this._writeRows([]);
    });
    return this;
  }

  async _readRows() {
    let text;
    try {
      text = await fs.promises.readFile(this.file, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
    return parse(text, { columns: true, skip_empty_lines: true, bom: true, trim: false });
  }

  async _writeRows(records) {
    const csv = stringify(records, { header: true, columns: this.columns });
    const tmp = `${this.file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(tmp, csv, 'utf8');
      await fs.promises.rename(tmp, this.file);
    } catch (e) {
      await fs.promises.rm(tmp, { force: true }).catch(() => {});
      throw e;
    }
  }
}

module.exports = { CsvTable };
