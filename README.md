# cc-mermaid

[![Proudly Vibe Coded](https://vibecoded.fyi/badges/flat/main/proudly-vibe-coded-midnight-glow.svg)](https://vibecoded.fyi)

A [Claude Code](https://claude.com/claude-code) plugin that renders `mermaid` diagrams
from chat responses to a self-contained HTML file, then links (or auto-opens) it in
your browser — because Claude Code doesn't render diagrams inline.

## Why

Claude Code (CLI and Desktop) doesn't render markdown images or mermaid diagrams inline
in the chat transcript — a ` ```mermaid ` block just shows up as raw text. This plugin
gives Claude a tool to render that diagram to an actual viewable HTML file and drop a
link to it right in the response.

## How it works

- `skills/render-mermaid/SKILL.md` instructs Claude to run the bundled render script
  every time it writes a ` ```mermaid ` code block, then append the resulting link
  under the block.
- `scripts/render.js` reads mermaid source on stdin, writes a standalone HTML file
  (mermaid.js pulled from CDN) to `~/.claude/cc-mermaid/renders/`, and optionally opens
  it in your default browser.
- `scripts/config.js` reads/writes `~/.claude/cc-mermaid/config.json`.
- `/cc-mermaid:mermaid-autoopen on|off` toggles the `autoOpen` setting.

## Install

Point Claude Code at this repo as a plugin source (via `--plugin-dir` for local dev,
or add it through your plugin marketplace flow once published):

```
claude --plugin-dir /path/to/cc-mermaid
```

Then just ask Claude for a diagram, or turn on auto-open first:

```
/cc-mermaid:mermaid-autoopen on
```

Run `/reload-plugins` after editing plugin files during development.

## Requirements

- Node.js (bundled scripts are plain Node, no dependencies).
- Internet access to load mermaid.js from the jsdelivr CDN when viewing a rendered file.

## License

MIT
