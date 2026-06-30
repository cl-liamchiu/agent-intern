'use strict';

const { getDb } = require('../lib/db');

const VALID_STATUSES = ['todo', 'in-progress', 'review', 'done', 'rejected'];

module.exports = function status(bugId, newStatus) {
  if (!VALID_STATUSES.includes(newStatus)) {
    console.error(`Error: invalid status "${newStatus}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    process.exit(1);
  }

  const db = getDb(process.cwd());
  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(bugId);

  if (!bug) {
    console.error(`Error: bug "${bugId}" not found`);
    process.exit(1);
  }

  db.prepare('UPDATE bugs SET status = ? WHERE id = ?').run(newStatus, bugId);
  console.log(`${bugId}: ${bug.status} → ${newStatus}`);
};
