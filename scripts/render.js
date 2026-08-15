#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { readConfig, rendersDir } = require('./lib');

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
const SVG_PAN_ZOOM_CDN = 'https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js';

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
  :root {
    color-scheme: light dark;
    --bg: #fff;
    --fg: #1a1a1a;
    --bar-bg: #f5f5f5;
    --border: #ddd;
    --btn-bg: #fff;
    --btn-bg-hover: #ececec;
    --err: #c0392b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1e1e1e;
      --fg: #eee;
      --bar-bg: #2a2a2a;
      --border: #444;
      --btn-bg: #333;
      --btn-bg-hover: #3d3d3d;
    }
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    height: 100%;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, Segoe UI, sans-serif;
    overflow: hidden;
  }
  #toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    background: var(--bar-bg);
    border-bottom: 1px solid var(--border);
    -webkit-user-select: none;
    user-select: none;
  }
  #toolbar button {
    background: var(--btn-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 13px;
    cursor: pointer;
    line-height: 1.2;
  }
  #toolbar button:hover { background: var(--btn-bg-hover); }
  #toolbar button:active { transform: translateY(1px); }
  #zoomLevel {
    font-size: 12px;
    min-width: 48px;
    text-align: center;
    opacity: 0.75;
  }
  #spacer { flex: 1; }
  #hint {
    font-size: 11px;
    opacity: 0.55;
  }
  #stage {
    position: relative;
    width: 100%;
    height: calc(100% - 41px);
    overflow: hidden;
    cursor: grab;
  }
  #stage.grabbing { cursor: grabbing; }
  #diagram {
    width: 100%;
    height: 100%;
  }
  #diagram svg {
    width: 100%;
    height: 100%;
  }
  #err {
    color: var(--err);
    font-family: monospace;
    white-space: pre-wrap;
    padding: 1rem;
  }
</style>
</head>
<body>
<div id="toolbar">
  <button id="zoomOut" title="Zoom out (-)">&minus;</button>
  <span id="zoomLevel">100%</span>
  <button id="zoomIn" title="Zoom in (+)">+</button>
  <button id="fit" title="Fit to screen (f)">Fit</button>
  <button id="reset" title="Reset (0)">Reset</button>
  <button id="download" title="Download SVG">Download SVG</button>
  <div id="spacer"></div>
  <span id="hint">scroll to zoom &middot; drag to pan &middot; dblclick to zoom in</span>
</div>
<div id="stage">
  <div id="diagram">
    <pre class="mermaid">
${escaped}
    </pre>
  </div>
</div>
<div id="err"></div>
<script src="${MERMAID_CDN}"></script>
<script src="${SVG_PAN_ZOOM_CDN}"></script>
<script>
  var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });

  mermaid.run().then(function () {
    var svgEl = document.querySelector('#diagram svg');
    if (!svgEl) return;
    svgEl.removeAttribute('height');
    svgEl.style.maxWidth = 'none';

    var panZoom = svgPanZoom(svgEl, {
      panEnabled: true,
      zoomEnabled: true,
      controlIconsEnabled: false,
      dblClickZoomEnabled: true,
      mouseWheelZoomEnabled: true,
      preventMouseEventsDefault: true,
      fit: true,
      center: true,
      minZoom: 0.1,
      maxZoom: 40,
      zoomScaleSensitivity: 0.35,
      onZoom: updateZoomLabel
    });

    function updateZoomLabel() {
      var z = panZoom.getZoom();
      document.getElementById('zoomLevel').textContent = Math.round(z * 100) + '%';
    }
    updateZoomLabel();

    var stage = document.getElementById('stage');
    stage.addEventListener('mousedown', function () { stage.classList.add('grabbing'); });
    window.addEventListener('mouseup', function () { stage.classList.remove('grabbing'); });

    document.getElementById('zoomIn').addEventListener('click', function () {
      panZoom.zoomIn();
    });
    document.getElementById('zoomOut').addEventListener('click', function () {
      panZoom.zoomOut();
    });
    document.getElementById('fit').addEventListener('click', function () {
      panZoom.resize();
      panZoom.fit();
      panZoom.center();
      updateZoomLabel();
    });
    document.getElementById('reset').addEventListener('click', function () {
      panZoom.resize();
      panZoom.fit();
      panZoom.center();
      panZoom.zoom(1);
      updateZoomLabel();
    });
    document.getElementById('download').addEventListener('click', function () {
      var serializer = new XMLSerializer();
      var svgCopy = svgEl.cloneNode(true);
      svgCopy.removeAttribute('style');
      var source = serializer.serializeToString(svgCopy);
      var blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'diagram.svg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

    window.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '+' || e.key === '=') panZoom.zoomIn();
      else if (e.key === '-' || e.key === '_') panZoom.zoomOut();
      else if (e.key === '0') {
        panZoom.resize(); panZoom.fit(); panZoom.center(); panZoom.zoom(1); updateZoomLabel();
      } else if (e.key === 'f' || e.key === 'F') {
        panZoom.resize(); panZoom.fit(); panZoom.center(); updateZoomLabel();
      }
    });

    window.addEventListener('resize', function () {
      panZoom.resize();
      panZoom.fit();
      panZoom.center();
    });
  }).catch(function (e) {
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
