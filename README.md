# cc-mermaid

[![Proudly Vibe Coded](https://vibecoded.fyi/badges/flat/main/proudly-vibe-coded-midnight-glow.svg)](https://vibecoded.fyi)

A [Claude Code](https://claude.com/claude-code) plugin that renders `mermaid` diagrams
from chat responses **inline in the transcript** where the client can draw them, and to a
self-contained HTML file it links (or auto-opens) everywhere else.

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
- `hooks/inline.tsx` is a [mod](https://code.claude.com/docs/en/plugins/mods/interface)
  (a function-hooks module) that hooks the `AssistantMessage` render site and redraws
  each ` ```mermaid ` block as the diagram itself, see below.

## Inline diagrams

Claude Code mods can redraw parts of the transcript. cc-mermaid uses that to replace a
finished ` ```mermaid ` block in Claude's reply with the rendered diagram:

| Where | What you see |
| --- | --- |
| Desktop app, VS Code, mobile | The diagram as an SVG, inline |
| kitty, Ghostty (kitty graphics protocol) | The diagram as a PNG image, inline |
| Any other terminal | The usual code block plus the HTML link |

The reply text Claude (and the transcript file) holds is never changed, only how it is
drawn. While a diagram renders, or if it fails, the reply is drawn as before.

Rendering runs `node` on your machine with one of two renderers, chosen in `/config`
(or `pluginConfigs.cc-mermaid.options` in settings):

- `renderer`: `mermaid.ink` (default) sends the diagram source to the public
  [mermaid.ink](https://mermaid.ink) service. Pick `mmdc` to render locally with
  [`@mermaid-js/mermaid-cli`](https://github.com/mermaid-js/mermaid-cli)
  (`npm i -g @mermaid-js/mermaid-cli`) so nothing leaves your machine, or `off` to
  disable inline drawing.
- `theme`: `default`, `dark`, `neutral` or `forest`.
- `terminalImages`: `auto` (detect kitty/Ghostty), `always`, or `never`.

Rendered images are cached by content under `~/.claude/cc-mermaid/renders/inline/`.

Mods are an early-access Claude Code feature (built and tested against Claude Code
2.1.287). On a build without them, inline drawing is unavailable and the HTML link
remains the way to view diagrams.

## Install

From another Claude Code session:

```
/plugin marketplace add KhaiStimpson/cc-mermaid
/plugin install cc-mermaid@cc-mermaid-marketplace
```

Or for local development, point Claude Code at a local checkout directly:

```
claude --plugin-dir /path/to/cc-mermaid
```

Then just ask Claude for a diagram, or turn on auto-open first:

```
/cc-mermaid:mermaid-autoopen on
```

Run `/reload-plugins` after editing plugin files during development. To check the
mod: `claude plugin validate .` and `claude plugin test .`.

## Requirements

- Node.js 18+ (bundled scripts are plain Node, no dependencies).
- Internet access to load mermaid.js from the jsdelivr CDN when viewing a rendered file.

## License

MIT
