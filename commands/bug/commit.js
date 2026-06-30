'use strict';

const path = require('path');
const { execFileSync } = require('child_process');
const { getAgentDir } = require('../../lib/paths');
const { getDb } = require('../../lib/db');

module.exports = function commit(bugId, options, cwd) {
  if (typeof cwd !== 'string') cwd = process.cwd();

  // 1. Check for staged changes
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], { cwd });
    console.error('Error: no staged changes found. Stage your changes first.');
    process.exit(1);
  } catch (err) {
    if (err.status !== 1) {
      console.error(`Error checking staged changes: ${err.message}`);
      process.exit(1);
    }
  }

  const { prompt: commitPrompt, transform } = require(path.join(getAgentDir(cwd), 'commit.js'));

  const db = getDb(cwd);
  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(bugId);
  if (!bug) {
    console.error(`Error: bug "${bugId}" not found in local database`);
    process.exit(1);
  }

  // 2. Run claude
  const claudeArgs = ['-p', commitPrompt, '--output-format', 'json'];
  if (options?.resume) claudeArgs.push('--resume', options.resume);

  let rawOutput;
  try {
    rawOutput = execFileSync('claude', claudeArgs, {
      encoding: 'utf8',
      cwd,
    });
  } catch (err) {
    console.error(`Error running claude: ${err.message}`);
    process.exit(1);
  }

  let claudeResult;
  try {
    claudeResult = JSON.parse(rawOutput);
  } catch (_) {
    console.error('Error: claude did not return valid JSON');
    process.exit(1);
  }

  db.prepare(`
    INSERT INTO agent_logs (bug_id, action_type, session_id, total_cost_usd, response_json)
    VALUES (?, 'commit', ?, ?, ?)
  `).run(bugId, claudeResult.session_id ?? null, claudeResult.total_cost_usd ?? null, rawOutput);

  // 3. Derive commit message
  const commitMessage = typeof transform === 'function'
    ? transform(claudeResult.result)
    : claudeResult.result;

  if (!commitMessage) {
    console.error('Error: could not derive a commit message from claude response');
    process.exit(1);
  }

  execFileSync('git', ['commit', '-m', commitMessage], { cwd, stdio: 'inherit' });

  db.prepare("UPDATE bugs SET status = 'review' WHERE id = ?").run(bugId);
};
