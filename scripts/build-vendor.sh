#!/usr/bin/env bash
# Rebuilds scripts/vendor/beautiful-mermaid.mjs: beautiful-mermaid (and its
# elkjs/entities dependencies) bundled into one dependency-free ES module that
# scripts/render-inline.mjs loads. Run after bumping VERSION; commit the output.
set -euo pipefail

VERSION="1.1.3"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
npm init -y >/dev/null
npm install --silent "beautiful-mermaid@$VERSION" esbuild@0.25
echo "export { renderMermaidSVG, renderMermaidASCII, THEMES } from 'beautiful-mermaid'" > entry.js
npx esbuild entry.js --bundle --format=esm --platform=neutral \
  --main-fields=module,main --minify --legal-comments=inline \
  --banner:js="// beautiful-mermaid@$VERSION bundled by scripts/build-vendor.sh. Do not edit. See THIRD_PARTY_NOTICES.md." \
  --outfile="$ROOT/scripts/vendor/beautiful-mermaid.mjs"
