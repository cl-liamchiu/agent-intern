'use strict';

const path = require('path');
const { getDb } = require('../../lib/db');
const { getAgentDir } = require('../../lib/paths');

module.exports = function fetch() {
  const cwd = process.cwd();
  const fetchFn = require(path.join(getAgentDir(cwd), 'fetch.js'));

  Promise.resolve(fetchFn()).then(bugs => {
    if (!Array.isArray(bugs)) {
      console.error('Error: fetch.js must return an array of bugs');
      process.exit(1);
    }

    const db = getDb(cwd);
    const upsert = db.prepare(`
      INSERT INTO bugs (id, title, description)
      VALUES (@id, @title, @description)
      ON CONFLICT(id) DO UPDATE SET
        title       = excluded.title,
        description = excluded.description
    `);

    db.transaction(() => {
      for (const bug of bugs) {
        upsert.run({ id: bug.id, title: bug.title, description: bug.description ?? null });
      }
    })();

    console.log(`Fetched and saved ${bugs.length} bug(s).`);
  }).catch(err => {
    console.error(`Error fetching bugs: ${err.message}`);
    process.exit(1);
  });
};
