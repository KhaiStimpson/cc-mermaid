'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Where persistent plugin data (config + rendered diagrams) lives.
// Prefers the harness-provided data dir; falls back to a dir next to
// Claude Code's own config so it survives across sessions/updates.
function dataDir() {
  const fromEnv = process.env.CLAUDE_PLUGIN_DATA;
  const dir = fromEnv && fromEnv.trim().length > 0
    ? fromEnv
    : path.join(os.homedir(), '.claude', 'cc-mermaid');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function configPath() {
  return path.join(dataDir(), 'config.json');
}

const DEFAULT_CONFIG = {
  autoOpen: false,
};

function readConfig() {
  const file = configPath();
  if (!fs.existsSync(file)) return { ...DEFAULT_CONFIG };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(config) {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function rendersDir() {
  const dir = path.join(dataDir(), 'renders');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { dataDir, configPath, readConfig, writeConfig, rendersDir, DEFAULT_CONFIG };
