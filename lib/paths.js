'use strict';

const fs = require('fs');
const path = require('path');

function getAgentDir(cwd) {
  const name = path.basename(cwd);
  const projectDir = name.endsWith('-agent')
    ? path.join(path.dirname(cwd), name.slice(0, -'-agent'.length))
    : cwd;
  const dir = path.join(projectDir, '.agent-intern');
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
