'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');

function getProjectName(cwd) {
  const name = path.basename(cwd);
  return name.endsWith('-agent') ? name.slice(0, -'-agent'.length) : name;
}

function getAgentDir(cwd) {
  const dir = path.join(os.homedir(), '.agent-pilot', getProjectName(cwd));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveProjectAndAgent(cwd) {
  const name = path.basename(cwd);
  if (name.endsWith('-agent')) {
    return {
      agentDir: cwd,
      projectDir: path.join(path.dirname(cwd), name.slice(0, -'-agent'.length)),
    };
  }
  return {
    projectDir: cwd,
    agentDir: path.join(path.dirname(cwd), name + '-agent'),
  };
}

module.exports = { getAgentDir, resolveProjectAndAgent };
