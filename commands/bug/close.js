'use strict';

const { execFileSync } = require('child_process');
const { getDb } = require('../../lib/db');

module.exports = function close(bugId, options) {
  const cwd = process.cwd();
  const baseBranch = options.base;

  if (!baseBranch) {
    console.error('Error: --base <branch> is required');
    process.exit(1);
  }

  const fixBranch = `fix/${baseBranch}/${bugId}`;

  // Verify fix branch exists locally
  let localBranches;
  try {
    localBranches = execFileSync('git', ['branch'], { cwd, encoding: 'utf8' });
  } catch (err) {
    console.error(`Error listing branches: ${err.message}`);
    process.exit(1);
  }

  if (!localBranches.split('\n').map(b => b.replace(/^\*?\s+/, '')).includes(fixBranch)) {
    console.error(`Error: branch "${fixBranch}" not found locally. Run "agent bug review ${bugId}" first.`);
    process.exit(1);
  }

  const run = (args) => execFileSync('git', args, { cwd, stdio: 'inherit' });

  // 1. Checkout fix branch and rebase onto base
  console.log(`Checking out ${fixBranch}...`);
  run(['checkout', fixBranch]);

  console.log(`Rebasing onto ${baseBranch}...`);
  run(['rebase', baseBranch]);

  // 2. Switch to base branch
  console.log(`Switching to ${baseBranch}...`);
  run(['checkout', baseBranch]);

  // 3. Fast-forward merge
  console.log(`Merging ${fixBranch}...`);
  run(['merge', '--ff-only', fixBranch]);

  // 4. Update bug status
  const db = getDb(cwd);
  db.prepare("UPDATE bugs SET status = 'done' WHERE id = ?").run(bugId);

  console.log(`\nDone. ${bugId} merged into ${baseBranch} and marked as done.`);
};
