'use strict';

const fs = require('fs');
const path = require('path');
const { getAgentDir } = require('../../lib/paths');

module.exports = function commitInit(options) {
  const cwd = process.cwd();
  const configPath = path.join(getAgentDir(cwd), 'config.json');
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};

  if (options.prompt) {
    const resolved = path.resolve(cwd, options.prompt);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: prompt file not found: ${resolved}`);
      process.exit(1);
    }
    (config.commit ??= {}).promptPath = resolved;
  }

  if (options.script) {
    const resolved = path.resolve(cwd, options.script);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: script not found: ${resolved}`);
      process.exit(1);
    }
    (config.commit ??= {}).scriptPath = resolved;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('Commit settings saved.');
};
