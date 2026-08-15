#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { readConfig, rendersDir } = require('./lib');

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function toFileUrl(absPath) {
  const normalized = absPath.replace(/\\/g, '/');
  const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `file://${encodeURI(withSlash)}`;
}

function buildHtml(source) {
  const escaped = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Mermaid Diagram</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: #1a1a1a;
    font-family: -apple-system, Segoe UI, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #1e1e1e; color: #eee; }
  }
  .mermaid { max-width: 95vw; }
  #err { color: #c0392b; font-family: monospace; white-space: pre-wrap; padding: 1rem; }
</style>
</head>
<body>
<pre class="mermaid">
${escaped}
</pre>
<div id="err"></div>
<script src="${MERMAID_CDN}"></script>
<script>
  mermaid.initialize({ startOnLoad: false, theme: 'default' });
  mermaid.run().catch(function (e) {
    document.getElementById('err').textContent = 'Failed to render diagram:\\n' + e.message;
  });
</script>
</body>
</html>
`;
}

function openInBrowser(absPath) {
  const platform = process.platform;
  if (platform === 'win32') {
    execFile('cmd', ['/c', 'start', '""', absPath], () => {});
  } else if (platform === 'darwin') {
    execFile('open', [absPath], () => {});
  } else {
    execFile('xdg-open', [absPath], () => {});
  }
}

function main() {
  const args = process.argv.slice(2);
  const forceOpen = args.includes('--open');
  const forceNoOpen = args.includes('--no-open');

  const source = readStdin().trim();
  if (!source) {
    process.stderr.write('No mermaid source received on stdin.\n');
    process.exit(1);
  }

  const hash = crypto.createHash('sha1').update(source).digest('hex').slice(0, 10);
  const fileName = `diagram-${hash}.html`;
  const outPath = path.join(rendersDir(), fileName);
  fs.writeFileSync(outPath, buildHtml(source), 'utf8');

  const config = readConfig();
  const shouldOpen = forceOpen || (config.autoOpen && !forceNoOpen);
  if (shouldOpen) openInBrowser(outPath);

  process.stdout.write(`PATH: ${outPath}\n`);
  process.stdout.write(`URL: ${toFileUrl(outPath)}\n`);
  process.stdout.write(`OPENED: ${shouldOpen}\n`);
}

main();
