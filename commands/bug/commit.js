'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getAgentDir } = require('../../lib/paths');
const { getDb } = require('../../lib/db');

const DEFAULT_PROMPT = 'Look at my staged changes and create an appropriate commit message.';

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
    // exit code 1 means there are staged changes — proceed
  }

  const agentDir = getAgentDir(cwd);
  const configPath = path.join(agentDir, 'config.json');
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};

  const db = getDb(cwd);
  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(bugId);
  if (!bug) {
    console.error(`Error: bug "${bugId}" not found in local database`);
    process.exit(1);
  }

  // 2. Build and run claude
  const prompt = config.commit?.promptPath
    ? fs.readFileSync(config.commit.promptPath, 'utf8').trim()
    : DEFAULT_PROMPT;

  const claudeArgs = ['-p', prompt, '--output-format', 'json'];
  if (options?.resume) claudeArgs.push('--resume', options.resume);

  const stdinInput = `Bug ID: ${bug.id}\nTitle: ${bug.title}\n\nDescription:\n${bug.description || ''}`;

  let rawOutput;
  try {
    rawOutput = execFileSync('claude', claudeArgs, {
      input: stdinInput,
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

  // Save to agent_logs
  db.prepare(`
    INSERT INTO agent_logs (bug_id, action_type, session_id, total_cost_usd, response_json)
    VALUES (?, 'commit', ?, ?, ?)
  `).run(bugId, claudeResult.session_id ?? null, claudeResult.total_cost_usd ?? null, rawOutput);

  // 3. Derive commit message
  let commitMessage;
  if (config.commit?.scriptPath) {
    try {
      commitMessage = execFileSync(config.commit.scriptPath, [], {
        input: claudeResult.result,
        encoding: 'utf8',
      }).trim();
    } catch (err) {
      console.error(`Error running transform script: ${err.message}`);
      process.exit(1);
    }
  } else {
    commitMessage = claudeResult.result;
  }

  if (!commitMessage) {
    console.error('Error: could not derive a commit message from claude response');
    process.exit(1);
  }

  execFileSync('git', ['commit', '-m', commitMessage], { cwd, stdio: 'inherit' });

  db.prepare("UPDATE bugs SET status = 'review' WHERE id = ?").run(bugId);
};
