'use strict';

const fs = require('fs');
const path = require('path');
const { getAgentDir } = require('../../lib/paths');

module.exports = function fetchInit(scriptPath) {
  const cwd = process.cwd();
  const resolved = path.resolve(cwd, scriptPath);

  if (!fs.existsSync(resolved)) {
    console.error(`Error: script not found: ${resolved}`);
    process.exit(1);
  }

  const configPath = path.join(getAgentDir(cwd), 'config.json');
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};

  config.fetchScript = resolved;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`Fetch script registered: ${resolved}`);
};
