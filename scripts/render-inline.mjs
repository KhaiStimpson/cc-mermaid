#!/usr/bin/env node
// Renders one mermaid diagram for the inline-diagram mod (hooks/inline.tsx),
// locally, with the bundled beautiful-mermaid: no browser, no network.
//
// stdin:  {"source": "...", "kind": "svg" | "ascii", "theme": "zinc-dark"}
// stdout: {"ok": true, "out": "..."} or {"ok": false, "reason": "..."}
import { readFileSync } from 'node:fs';
import { renderMermaidASCII, renderMermaidSVG, THEMES } from './vendor/beautiful-mermaid.mjs';

function render({ source, kind, theme }) {
  if (kind === 'ascii') return renderMermaidASCII(source, { colorMode: 'none' });
  const svg = renderMermaidSVG(source, THEMES[theme] ?? THEMES['zinc-dark']);
  // beautiful-mermaid imports its font from Google Fonts; use the system font
  // stack instead so the drawing never reaches the network.
  return svg.replace(/^\s*@import url\([^)]*\);?\s*$/gm, '');
}

let result;
try {
  result = { ok: true, out: render(JSON.parse(readFileSync(0, 'utf8'))) };
} catch (err) {
  result = { ok: false, reason: String((err && err.message) || err) };
}
process.stdout.write(JSON.stringify(result) + '\n');
