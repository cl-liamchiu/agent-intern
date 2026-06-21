'use strict';

const { execFileSync } = require('child_process');

module.exports = function update(branchName, _opts, cwd) {
  if (typeof cwd !== 'string') cwd = process.cwd();

  if (!branchName) {
    try {
      branchName = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })
        .toString()
        .trim();
    } catch (_) {
      console.error('Error: could not determine current branch. Are you inside a git repository?');
      process.exit(1);
    }
  }

  console.log(`Pushing branch "${branchName}" to agent...`);
  execFileSync('git', ['push', 'agent', branchName], { cwd, stdio: 'inherit' });
};
