'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = function init(projectName) {
  const cwd = process.cwd();
  const projectDir = path.resolve(cwd, projectName);
  const agentDir = path.resolve(cwd, `${projectName}-agent`);

  // Step 1: check project folder exists and has git
  if (!fs.existsSync(projectDir)) {
    console.error(`Error: folder "${projectName}" not found in ${cwd}`);
    process.exit(1);
  }

  if (!fs.existsSync(path.join(projectDir, '.git'))) {
    console.error(`Error: "${projectName}" is not a git repository`);
    process.exit(1);
  }

  // Step 2: create {projectName}-agent folder if it doesn't exist
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
    console.log(`Created ${projectName}-agent/`);
  } else {
    console.log(`Folder ${projectName}-agent/ already exists, skipping creation`);
  }

  // Step 3: git init and configure in the agent folder
  const run = (args, dir) =>
    execFileSync('git', args, { cwd: dir, stdio: 'inherit' });

  if (!fs.existsSync(path.join(agentDir, '.git'))) {
    run(['init'], agentDir);
  } else {
    console.log(`${projectName}-agent/ already a git repo, skipping git init`);
  }

  run(['config', 'receive.denyCurrentBranch', 'updateInstead'], agentDir);
  console.log('Set receive.denyCurrentBranch = updateInstead');

  // Step 4: add "agent" remote in the project folder (if not already set)
  let existingRemotes = '';
  try {
    existingRemotes = execFileSync('git', ['remote'], { cwd: projectDir }).toString().trim();
  } catch (_) {}

  if (existingRemotes.split('\n').includes('agent')) {
    console.log('Remote "agent" already exists, skipping');
  } else {
    run(['remote', 'add', 'agent', agentDir], projectDir);
    console.log(`Added remote "agent" → ${agentDir}`);
  }

  console.log('\nDone. Agent mirror ready.');
};
