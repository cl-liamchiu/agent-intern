'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getAgentDir, resolveProjectAndAgent } = require('../../lib/paths');
const { getDb } = require('../../lib/db');
const commit = require('./commit');
const update = require('../update');

module.exports = function fix(bugIds, options, cwd) {
  if (typeof cwd !== 'string') cwd = process.cwd();

  const { projectDir, agentDir } = resolveProjectAndAgent(cwd);

  if (!fs.existsSync(agentDir)) {
    console.error(`Error: agent folder not found: ${agentDir}`);
    process.exit(1);
  }

  const fixPrompt = require(path.join(getAgentDir(cwd), 'fix.js'));

  const db = getDb(cwd);

  // Resolve which bugs to process
  let bugs;
  if (options.all) {
    bugs = db.prepare("SELECT * FROM bugs WHERE status = 'todo'").all();
    if (bugs.length === 0) {
      console.log('No todo bugs found.');
      return;
    }
  } else {
    if (!bugIds || bugIds.length === 0) {
      console.error('Error: provide at least one bug ID or use --all');
      process.exit(1);
    }
    bugs = bugIds.map((id) => {
      const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);
      if (!bug) {
        console.error(`Error: bug "${id}" not found`);
        process.exit(1);
      }
      return bug;
    });
  }

  const baseBranch = options.base;
  if (!baseBranch) {
    console.error('Error: --base <branch> is required');
    process.exit(1);
  }

  for (const bug of bugs) {
    if (bug.status !== 'todo') {
      console.log(`Skipping ${bug.id} (status: ${bug.status})`);
      continue;
    }

    console.log(`\nFixing ${bug.id}: ${bug.title}`);

    db.prepare("UPDATE bugs SET status = 'in-progress' WHERE id = ?").run(bug.id);

    // 1. Push base branch to agent
    update(baseBranch, {}, projectDir);

    // 2. Create fix branch in agent dir
    const fixBranch = `fix/${baseBranch}/${bug.id}`;
    try {
      execFileSync('git', ['checkout', '-b', fixBranch, baseBranch], { cwd: agentDir, stdio: 'inherit' });
    } catch (err) {
      console.error(`Error creating branch ${fixBranch}: ${err.message}`);
      process.exit(1);
    }

    // 3. Run claude to fix the bug
    const prompt = typeof fixPrompt === 'function' ? fixPrompt(bug) : fixPrompt;
    const claudeArgs = ['-p', prompt, '--output-format', 'json'];

    let rawOutput;
    try {
      rawOutput = execFileSync('claude', claudeArgs, {
        encoding: 'utf8',
        cwd: agentDir,
        stdio: ['pipe', 'pipe', 'inherit'],
      });
    } catch (err) {
      console.error(`Error running claude for ${bug.id}: ${err.message}`);
      execFileSync('git', ['switch', baseBranch], { cwd: agentDir, stdio: 'inherit' });
      process.exit(1);
    }

    let claudeResult;
    try {
      claudeResult = JSON.parse(rawOutput);
    } catch (_) {
      console.error(`Error: claude returned invalid JSON for ${bug.id}`);
      execFileSync('git', ['switch', baseBranch], { cwd: agentDir, stdio: 'inherit' });
      process.exit(1);
    }

    // Save fix log
    db.prepare(`
      INSERT INTO agent_logs (bug_id, action_type, session_id, total_cost_usd, response_json)
      VALUES (?, 'fix', ?, ?, ?)
    `).run(bug.id, claudeResult.session_id ?? null, claudeResult.total_cost_usd ?? null, rawOutput);

    // Stage all changes made by claude
    execFileSync('git', ['add', '-A'], { cwd: agentDir });

    // 4. Commit using the fix session
    commit(bug.id, { resume: claudeResult.session_id }, agentDir);

    // 5. Switch back to base branch
    execFileSync('git', ['switch', baseBranch], { cwd: agentDir, stdio: 'inherit' });

    console.log(`Done: ${bug.id}`);
  }
};
