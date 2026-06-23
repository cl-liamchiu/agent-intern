'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = function init(projectArg) {
  const cwd = process.cwd();
  const projectDir = path.resolve(cwd, projectArg);
  const name = path.basename(projectDir);
  const agentDir = path.resolve(path.dirname(projectDir), `${name}-agent`);

  // Step 1: check project folder exists and has git
  if (!fs.existsSync(projectDir)) {
    console.error(`Error: folder "${name}" not found in ${cwd}`);
    process.exit(1);
  }

  if (!fs.existsSync(path.join(projectDir, '.git'))) {
    console.error(`Error: "${name}" is not a git repository`);
    process.exit(1);
  }

  // Step 2: create {name}-agent folder if it doesn't exist
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
    console.log(`Created ${name}-agent/`);
  } else {
    console.log(`Folder ${name}-agent/ already exists, skipping creation`);
  }

  // Step 3: git init and configure in the agent folder
  const run = (args, dir) =>
    execFileSync('git', args, { cwd: dir, stdio: 'inherit' });

  if (!fs.existsSync(path.join(agentDir, '.git'))) {
    run(['init'], agentDir);
  } else {
    console.log(`${name}-agent/ already a git repo, skipping git init`);
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

  // Step 5: write Claude sandbox settings into the agent folder
  const claudeDir = path.join(agentDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const sandboxSettings = {
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: false,
      filesystem: {
        denyWrite: ['~'],
        denyRead: ['~'],
        allowWrite: ['.'],
        allowRead: ['.'],
      },
      network: {
        allowedDomains: [],
      },
    },
  };
  fs.writeFileSync(
    path.join(claudeDir, 'settings.local.json'),
    JSON.stringify(sandboxSettings, null, 2)
  );
  console.log('Created .claude/settings.local.json with sandbox config');

  // Step 6: exclude .claude/ from git tracking via .git/info/exclude (local, never committed)
  const excludePath = path.join(agentDir, '.git', 'info', 'exclude');
  const excludeContent = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  if (!excludeContent.includes('.claude/settings.local.json')) {
    fs.appendFileSync(excludePath, (excludeContent.endsWith('\n') || excludeContent === '' ? '' : '\n') + '.claude/settings.local.json\n');
    console.log('Added .claude/settings.local.json to agent mirror .git/info/exclude');
  }

  console.log('\nDone. Agent mirror ready.');
};
