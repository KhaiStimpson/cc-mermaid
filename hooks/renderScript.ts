// Run on the host as `node -e RENDER_SCRIPT -- <svg|png> <mermaid.ink|mmdc> <theme>`
// with the mermaid source on stdin. A hooks module has no Node and its
// $.http.fetch only returns text bodies, so the PNG download (and the local
// mmdc renderer) happen in this child process instead. Prints one JSON line:
// { path, width?, height?, svg? }. Results are cached by content hash next to
// the HTML renders, so scrolling or re-opening a session never re-renders.
export const RENDER_SCRIPT = String.raw`
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const [format, renderer, theme] = process.argv.slice(1);
const source = fs.readFileSync(0, 'utf8');
const bg = theme === 'dark' ? '1e1e1e' : 'ffffff';

const base = process.env.CLAUDE_PLUGIN_DATA && process.env.CLAUDE_PLUGIN_DATA.trim()
  ? process.env.CLAUDE_PLUGIN_DATA
  : path.join(os.homedir(), '.claude', 'cc-mermaid');
const dir = path.join(base, 'renders', 'inline');
fs.mkdirSync(dir, { recursive: true });

const hash = crypto.createHash('sha256')
  .update([format, renderer, theme, source].join('\0'))
  .digest('hex')
  .slice(0, 16);
const out = path.join(dir, 'diagram-' + hash + '.' + format);

function report() {
  const buf = fs.readFileSync(out);
  const result = { path: out };
  if (format === 'png') {
    result.width = buf.readUInt32BE(16);
    result.height = buf.readUInt32BE(20);
  } else {
    result.svg = buf.toString('utf8');
  }
  process.stdout.write(JSON.stringify(result) + '\n');
}

async function viaMermaidInk() {
  const encoded = Buffer.from(source, 'utf8').toString('base64url');
  const kind = format === 'svg' ? 'svg' : 'img';
  const query = (format === 'png' ? 'type=png&' : '') + 'theme=' + theme + '&bgColor=' + bg;
  const res = await fetch('https://mermaid.ink/' + kind + '/' + encoded + '?' + query);
  if (!res.ok) throw new Error('mermaid.ink answered ' + res.status);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

function viaMmdc() {
  const input = out + '.mmd';
  fs.writeFileSync(input, source, 'utf8');
  try {
    execFileSync('mmdc', ['-i', input, '-o', out, '-t', theme, '-b', '#' + bg, '-q'], {
      stdio: ['ignore', 'ignore', 'pipe'],
      shell: process.platform === 'win32',
      timeout: 60000,
    });
  } finally {
    fs.rmSync(input, { force: true });
  }
}

(async () => {
  if (!fs.existsSync(out)) {
    if (renderer === 'mmdc') viaMmdc();
    else await viaMermaidInk();
  }
  report();
})().catch(err => {
  fs.rmSync(out, { force: true });
  process.stderr.write(String(err && err.message || err) + '\n');
  process.exit(1);
});
`
