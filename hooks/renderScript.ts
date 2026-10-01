// Run on the host as `node -e RENDER_SCRIPT -- <svg|png> <theme> <mmdc>` with
// the mermaid source on stdin. Rendering is local, with mermaid-cli (mmdc):
// nothing about the diagram leaves the machine. A hooks module has no Node,
// so this runs in a child process instead. Prints one JSON line:
// { path, width?, height?, svg? }, or exits 1 with the reason on stderr
// (MMDC_NOT_FOUND when mermaid-cli is not installed). Results are cached by
// content hash next to the HTML renders, so a redraw never re-renders.
export const RENDER_SCRIPT = String.raw`
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const [format, theme, mmdc] = process.argv.slice(1);
const source = fs.readFileSync(0, 'utf8');
const bg = theme === 'dark' ? '#1e1e1e' : 'white';
// PNGs render at 2x for sharp terminal images; sizes are reported at 1x.
const PNG_SCALE = 2;

const base = process.env.CLAUDE_PLUGIN_DATA && process.env.CLAUDE_PLUGIN_DATA.trim()
  ? process.env.CLAUDE_PLUGIN_DATA
  : path.join(os.homedir(), '.claude', 'cc-mermaid');
const dir = path.join(base, 'renders', 'inline');
fs.mkdirSync(dir, { recursive: true });

const hash = crypto.createHash('sha256')
  .update([format, theme, source].join('\0'))
  .digest('hex')
  .slice(0, 16);
const out = path.join(dir, 'diagram-' + hash + '.' + format);

function render() {
  const input = out + '.mmd';
  fs.writeFileSync(input, source, 'utf8');
  // Plain SVG <text> labels rather than HTML in <foreignObject>, which an
  // image-drawn or sanitized SVG may drop.
  const config = out + '.json';
  fs.writeFileSync(config, JSON.stringify({ htmlLabels: false, flowchart: { htmlLabels: false } }));
  const args = ['-i', input, '-o', out, '-c', config, '-t', theme, '-b', bg, '-q'];
  if (format === 'png') args.push('-s', String(PNG_SCALE));
  // Optional puppeteer launch options (e.g. a Chrome path, or --no-sandbox).
  const puppeteerConfig = path.join(base, 'puppeteer-config.json');
  if (fs.existsSync(puppeteerConfig)) args.push('-p', puppeteerConfig);
  try {
    const isWindows = process.platform === 'win32';
    const ran = spawnSync(isWindows ? '"' + mmdc + '"' : mmdc, args.map(a => (isWindows ? '"' + a + '"' : a)), {
      encoding: 'utf8',
      shell: isWindows,
      timeout: 60000,
    });
    const stderr = (ran.stderr || '').trim();
    if (ran.error && ran.error.code === 'ENOENT') throw new Error('MMDC_NOT_FOUND');
    if (isWindows && ran.status !== 0 && /not recognized|cannot find/i.test(stderr)) throw new Error('MMDC_NOT_FOUND');
    if (ran.error) throw ran.error;
    if (ran.status !== 0 || !fs.existsSync(out)) throw new Error(stderr || 'mmdc exited ' + ran.status);
  } finally {
    fs.rmSync(input, { force: true });
    fs.rmSync(config, { force: true });
  }
}

function report() {
  const buf = fs.readFileSync(out);
  const result = { path: out };
  if (format === 'png') {
    result.width = Math.round(buf.readUInt32BE(16) / PNG_SCALE);
    result.height = Math.round(buf.readUInt32BE(20) / PNG_SCALE);
  } else {
    result.svg = buf.toString('utf8');
  }
  process.stdout.write(JSON.stringify(result) + '\n');
}

try {
  if (!fs.existsSync(out)) render();
  report();
} catch (err) {
  fs.rmSync(out, { force: true });
  process.stderr.write(String((err && err.message) || err) + '\n');
  process.exit(1);
}
`
