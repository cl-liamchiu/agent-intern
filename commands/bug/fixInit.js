'use strict';

const fs = require('fs');
const path = require('path');
const { getAgentDir } = require('../../lib/paths');

module.exports = function fixInit(options) {
  const cwd = process.cwd();

  if (!options.prompt) {
    console.error('Error: --prompt <path> is required');
    process.exit(1);
  }

  const resolved = path.resolve(cwd, options.prompt);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: prompt file not found: ${resolved}`);
    process.exit(1);
  }

  const configPath = path.join(getAgentDir(cwd), 'config.json');
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};

  (config.fix ??= {}).promptPath = resolved;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Fix prompt registered: ${resolved}`);
};
