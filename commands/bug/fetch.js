'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getDb } = require('../../lib/db');
const { getAgentDir } = require('../../lib/paths');

module.exports = function fetch() {
  const cwd = process.cwd();
  const configPath = path.join(getAgentDir(cwd), 'config.json');

  if (!fs.existsSync(configPath)) {
    console.error('Error: no fetch script configured. Run "agent bug fetch init <scriptPath>" first.');
    process.exit(1);
  }

  const { fetchScript } = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  if (!fetchScript) {
    console.error('Error: no fetch script configured. Run "agent bug fetch init <scriptPath>" first.');
    process.exit(1);
  }

  let output;
  try {
    output = execFileSync(fetchScript, { cwd }).toString();
  } catch (err) {
    console.error(`Error running fetch script: ${err.message}`);
    process.exit(1);
  }

  let bugs;
  try {
    bugs = JSON.parse(output);
  } catch (_) {
    console.error('Error: fetch script must return valid JSON');
    process.exit(1);
  }

  if (!Array.isArray(bugs)) {
    console.error('Error: fetch script must return a JSON array');
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
};
