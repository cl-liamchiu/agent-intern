'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getDb } = require('../lib/db');

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
    permissions: {
      allow: ['Read', 'Edit', 'Write'],
    },
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

  // Step 6: exclude .claude/settings.local.json from agent mirror git tracking
  const agentExcludePath = path.join(agentDir, '.git', 'info', 'exclude');
  const agentExcludeContent = fs.existsSync(agentExcludePath) ? fs.readFileSync(agentExcludePath, 'utf8') : '';
  if (!agentExcludeContent.includes('.claude/settings.local.json')) {
    fs.appendFileSync(agentExcludePath, (agentExcludeContent.endsWith('\n') || agentExcludeContent === '' ? '' : '\n') + '.claude/settings.local.json\n');
    console.log('Added .claude/settings.local.json to agent mirror .git/info/exclude');
  }

  // Step 7: exclude .agent-intern/ from project git tracking
  const projectExcludePath = path.join(projectDir, '.git', 'info', 'exclude');
  const projectExcludeContent = fs.existsSync(projectExcludePath) ? fs.readFileSync(projectExcludePath, 'utf8') : '';
  if (!projectExcludeContent.includes('.agent-intern/')) {
    fs.appendFileSync(projectExcludePath, (projectExcludeContent.endsWith('\n') || projectExcludeContent === '' ? '' : '\n') + '.agent-intern/\n');
    console.log('Added .agent-intern/ to project .git/info/exclude');
  }

  // Step 8: initialize .agent-intern/ with JS config files and bug DB
  const dataDir = path.join(projectDir, '.agent-intern');
  fs.mkdirSync(dataDir, { recursive: true });

  const templates = {
    'fetch.js': `'use strict';

// Fetch bugs from your tracker and return them as an array.
// Each bug must have: { id: string, title: string, description?: string }
//
// Example using GitHub Issues:
// const { execFileSync } = require('child_process');
// module.exports = async function fetchBugs() {
//   const output = execFileSync('gh', [
//     'issue', 'list',
//     '--repo', 'your-org/your-repo',
//     '--state', 'open',
//     '--json', 'number,title,body',
//   ]);
//   return JSON.parse(output).map(issue => ({
//     id: \`GITHUB-\${issue.number}\`,
//     title: issue.title,
//     description: issue.body,
//   }));
// };

module.exports = async function fetchBugs() {
  throw new Error('Not configured. Edit .agent-intern/fetch.js to fetch bugs from your tracker.');
};
`,
    'fix.js': `'use strict';

// Prompt sent to Claude when fixing a bug.
// Export a string, or a function(bug) => string for dynamic prompts.

module.exports = function fixPrompt(bug) {
  return \`Fix the following bug by modifying the appropriate code files.

Bug ID: \${bug.id}
Title: \${bug.title}

Description:
\${bug.description || 'No description provided.'}\`;
};
`,
    'commit.js': `'use strict';

// Prompt sent to Claude when generating a commit message.
// Optionally export a transform function to post-process Claude's response.

module.exports = {
  prompt: 'Look at the staged changes and write a concise commit message that describes what was fixed and why.',

  // Optional: transform Claude's response into the final commit message.
  // transform: (response) => response.trim(),
};
`,
  };

  for (const [filename, content] of Object.entries(templates)) {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content);
      console.log(`Created .agent-intern/${filename}`);
    }
  }

  getDb(projectDir);
  console.log('Initialized .agent-intern/bugs.db');

  console.log(`\nDone. Agent mirror ready at: ${agentDir}`);
};
