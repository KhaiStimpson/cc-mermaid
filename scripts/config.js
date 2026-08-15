#!/usr/bin/env node
'use strict';

const { readConfig, writeConfig } = require('./lib');

function main() {
  const [cmd, key, value] = process.argv.slice(2);

  if (cmd === 'get') {
    process.stdout.write(JSON.stringify(readConfig(), null, 2) + '\n');
    return;
  }

  if (cmd === 'set') {
    if (key !== 'auto-open') {
      process.stderr.write(`Unknown setting: ${key}\n`);
      process.exit(1);
    }
    if (value !== 'true' && value !== 'false') {
      process.stderr.write('Value must be "true" or "false"\n');
      process.exit(1);
    }
    const config = readConfig();
    config.autoOpen = value === 'true';
    writeConfig(config);
    process.stdout.write(`auto-open set to ${config.autoOpen}\n`);
    return;
  }

  process.stderr.write('Usage: config.js get | config.js set auto-open <true|false>\n');
  process.exit(1);
}

main();
