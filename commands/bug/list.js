'use strict';

const { getDb } = require('../../lib/db');

module.exports = function list() {
  const db = getDb(process.cwd());
  const bugs = db.prepare('SELECT id, title, status, created_at FROM bugs ORDER BY created_at ASC').all();

  if (bugs.length === 0) {
    console.log('No bugs found. Run "agent bug fetch" first.');
    return;
  }

  const cols = { id: 0, title: 0, status: 0 };
  for (const b of bugs) {
    cols.id = Math.max(cols.id, b.id.length);
    cols.title = Math.max(cols.title, b.title.length);
    cols.status = Math.max(cols.status, b.status.length);
  }

  const row = (id, title, status) =>
    `${id.padEnd(cols.id)}  ${title.padEnd(cols.title)}  ${status}`;

  console.log(row('ID', 'TITLE', 'STATUS'));
  console.log('-'.repeat(cols.id + cols.title + cols.status + 4));
  for (const b of bugs) {
    console.log(row(b.id, b.title, b.status));
  }
};
