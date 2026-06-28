'use strict';

const { execFileSync } = require('child_process');

module.exports = function review(bugId) {
  const cwd = process.cwd();

  // Fetch latest branches from agent mirror
  console.log('Fetching from agent...');
  try {
    execFileSync('git', ['fetch', 'agent'], { cwd, stdio: 'inherit' });
  } catch (err) {
    console.error(`Error fetching from agent: ${err.message}`);
    process.exit(1);
  }

  // Find the remote tracking branch matching fix/*/<bugId>
  let remoteBranches;
  try {
    remoteBranches = execFileSync('git', ['branch', '-r'], { cwd, encoding: 'utf8' });
  } catch (err) {
    console.error(`Error listing remote branches: ${err.message}`);
    process.exit(1);
  }

  const match = remoteBranches
    .split('\n')
    .map(b => b.trim())
    .find(b => b === `agent/fix/${bugId}` || b.startsWith(`agent/fix/`) && b.endsWith(`/${bugId}`));

  if (!match) {
    console.error(`Error: no fix branch found for bug "${bugId}". Has it been fixed yet?`);
    process.exit(1);
  }

  const remoteBranch = match; // e.g. agent/fix/main/GITHUB-1
  const localBranch = remoteBranch.replace(/^agent\//, ''); // e.g. fix/main/GITHUB-1

  // Check if local branch already exists
  let localBranches;
  try {
    localBranches = execFileSync('git', ['branch'], { cwd, encoding: 'utf8' });
  } catch (err) {
    console.error(`Error listing local branches: ${err.message}`);
    process.exit(1);
  }

  const exists = localBranches.split('\n').map(b => b.replace(/^\*?\s+/, '')).includes(localBranch);

  if (exists) {
    execFileSync('git', ['checkout', localBranch], { cwd, stdio: 'inherit' });
  } else {
    execFileSync('git', ['checkout', '-b', localBranch, remoteBranch], { cwd, stdio: 'inherit' });
  }

  console.log(`\nReviewing fix for ${bugId} on branch: ${localBranch}`);
};
