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
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Mermaid Diagram</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fafafa;
    --fg: #1a1a1a;
    --dot: rgba(0, 0, 0, 0.09);
    --bar-bg: rgba(255, 255, 255, 0.75);
    --border: rgba(0, 0, 0, 0.08);
    --btn-fg: #333;
    --btn-hover: rgba(0, 0, 0, 0.06);
    --btn-active: rgba(0, 0, 0, 0.12);
    --divider: rgba(0, 0, 0, 0.1);
    --shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06);
    --err: #c0392b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #17181a;
      --fg: #eee;
      --dot: rgba(255, 255, 255, 0.09);
      --bar-bg: rgba(38, 39, 42, 0.75);
      --border: rgba(255, 255, 255, 0.08);
      --btn-fg: #e6e6e6;
      --btn-hover: rgba(255, 255, 255, 0.09);
      --btn-active: rgba(255, 255, 255, 0.16);
      --divider: rgba(255, 255, 255, 0.12);
      --shadow: 0 8px 24px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3);
    }
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    height: 100dvh;
    overflow: hidden;
    overscroll-behavior: none;
    font-family: -apple-system, "Segoe UI", sans-serif;
    color: var(--fg);
  }
  #stage {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(var(--dot) 1.4px, transparent 1.4px) 0 0 / 22px 22px,
      var(--bg);
    cursor: grab;
    touch-action: none;
  }
  #stage.grabbing { cursor: grabbing; }
  #diagram, #diagram svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  #toolbar {
    position: fixed;
    left: 50%;
    bottom: max(18px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px;
    background: var(--bar-bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    -webkit-user-select: none;
    user-select: none;
    max-width: calc(100vw - 24px);
  }
  #toolbar button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: transparent;
    color: var(--btn-fg);
    border: none;
    border-radius: 9px;
    width: 34px;
    height: 34px;
    padding: 0;
    cursor: pointer;
    touch-action: manipulation;
  }
  #toolbar button.wide { width: auto; padding: 0 12px; font-size: 12.5px; font-weight: 500; }
  #toolbar button:hover { background: var(--btn-hover); }
  #toolbar button:active { background: var(--btn-active); }
  #toolbar button svg { width: 17px; height: 17px; }
  #zoomLevel {
    min-width: 42px;
    text-align: center;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
    -webkit-user-select: none;
    user-select: none;
  }
  .divider {
    width: 1px;
    height: 20px;
    background: var(--divider);
    margin: 0 4px;
    flex: 0 0 auto;
  }
  #hint {
    position: fixed;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11.5px;
    opacity: 0.45;
    white-space: nowrap;
    pointer-events: none;
  }
  @media (max-width: 560px) {
    #hint { display: none; }
    #toolbar button.wide span.label { display: none; }
    #toolbar button.wide { width: 34px; padding: 0; }
  }
  #err {
    position: absolute;
    inset: 0;
    color: var(--err);
    background: var(--bg);
    font-family: ui-monospace, "SF Mono", Consolas, monospace;
    font-size: 13px;
    white-space: pre-wrap;
    padding: 1.25rem;
    overflow: auto;
  }
  #err:empty { display: none; }
</style>
</head>
<body>
<div id="stage">
  <div id="diagram">
    <pre class="mermaid">
${escaped}
    </pre>
  </div>
</div>
<span id="hint">scroll to zoom &middot; drag to pan &middot; dblclick to zoom in</span>
<div id="toolbar">
  <button id="zoomOut" title="Zoom out (-)" aria-label="Zoom out">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </button>
  <span id="zoomLevel">100%</span>
  <button id="zoomIn" title="Zoom in (+)" aria-label="Zoom in">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </button>
  <div class="divider"></div>
  <button id="fit" class="wide" title="Fit to screen (f)" aria-label="Fit to screen">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
    <span class="label">Fit</span>
  </button>
  <button id="reset" class="wide" title="Reset zoom (0)" aria-label="Reset zoom">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
    <span class="label">Reset</span>
  </button>
  <div class="divider"></div>
  <button id="download" title="Download SVG" aria-label="Download SVG">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
  </button>
</div>
<div id="err"></div>
<script src="${MERMAID_CDN}"></script>
<script src="${SVG_PAN_ZOOM_CDN}"></script>
<script>
  var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });

  function nextFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { requestAnimationFrame(resolve); });
    });
  }

  mermaid.run()
    .then(nextFrame)
    .then(function () {
    var svgEl = document.querySelector('#diagram svg');
    if (!svgEl) return;
    svgEl.removeAttribute('width');
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
      contain: false,
      center: true,
      minZoom: 0.05,
      maxZoom: 40,
      zoomScaleSensitivity: 0.35,
      // Small negative offset so "fit" fills the canvas edge-to-edge
      // (default fit leaves a wide margin) rather than reading tiny in the middle.
      onZoom: updateZoomLabel
    });

    function refit() {
      panZoom.resize();
      panZoom.fit();
      // svg-pan-zoom's fit() leaves the diagram noticeably smaller than the
      // canvas on most aspect ratios; nudge it up so it reads as "filling" it.
      panZoom.zoom(panZoom.getZoom() * 1.12);
      panZoom.center();
      updateZoomLabel();
    }

    function updateZoomLabel() {
      var z = panZoom.getZoom();
      document.getElementById('zoomLevel').textContent = Math.round(z * 100) + '%';
    }
    // Layout may still shift a frame after init (fonts, scrollbars); settle once more.
    refit();

    var stage = document.getElementById('stage');
    stage.addEventListener('mousedown', function () { stage.classList.add('grabbing'); });
    window.addEventListener('mouseup', function () { stage.classList.remove('grabbing'); });

    document.getElementById('zoomIn').addEventListener('click', function () {
      panZoom.zoomIn();
    });
    document.getElementById('zoomOut').addEventListener('click', function () {
      panZoom.zoomOut();
    });
    document.getElementById('fit').addEventListener('click', refit);
    document.getElementById('reset').addEventListener('click', function () {
      refit();
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
      else if (e.key === '0') { refit(); panZoom.zoom(1); updateZoomLabel(); }
      else if (e.key === 'f' || e.key === 'F') refit();
    });

    if (window.ResizeObserver) {
      var resizeObserver = new ResizeObserver(function () { refit(); });
      resizeObserver.observe(stage);
    } else {
      window.addEventListener('resize', refit);
    }
    window.addEventListener('orientationchange', refit);
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
