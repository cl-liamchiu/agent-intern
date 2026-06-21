'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { getAgentDir } = require('./paths');

function getDb(cwd) {
  const agentDir = getAgentDir(cwd);
  const db = new Database(path.join(agentDir, 'bugs.db'));

  db.exec(`
    CREATE TABLE IF NOT EXISTS bugs (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT DEFAULT 'todo',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      bug_id         TEXT NOT NULL,
      action_type    TEXT NOT NULL,
      session_id     TEXT,
      total_cost_usd REAL,
      response_json  TEXT,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

module.exports = { getDb };
