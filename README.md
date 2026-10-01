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
  each ` ```mermaid ` block as the diagram itself, rendered by `scripts/render-inline.mjs`;
  see below.

## Inline diagrams

Claude Code mods can redraw parts of the transcript. cc-mermaid uses that to replace a
finished ` ```mermaid ` block in Claude's reply with the rendered diagram:

| Where | What you see |
| --- | --- |
| Desktop app, VS Code, mobile | The diagram as an SVG |
| Terminal | The diagram in Unicode box-drawing characters |

The reply text Claude (and the transcript file) holds is never changed, only how it is
drawn. While a diagram renders, the reply is drawn as before.

Diagrams are rendered **locally** by [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid),
bundled with the plugin (`scripts/vendor/`) and run with Node: no browser, nothing to
install, and the diagram never leaves your machine. It draws flowcharts, state, sequence,
class and ER diagrams and XY charts. Other types (pie, gantt, mindmap, ...), diagrams with
a syntax error, and terminal diagrams too wide for the window keep their code block and
the HTML link, which uses the full mermaid.js.

Options, in `/config` (or `pluginConfigs.cc-mermaid.options` in settings):

- `inline`: draw diagrams inline (default on); off leaves the HTML link only.
- `theme`: colors for SVG diagrams. `auto` (default) follows Claude Code's light or
  dark theme; or pick one of beautiful-mermaid's themes (`github-dark`, `nord`,
  `dracula`, `tokyo-night`, ...).

To update the bundled renderer, bump `VERSION` in `scripts/build-vendor.sh`, run it, and
commit `scripts/vendor/beautiful-mermaid.mjs`.

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

- Node.js (bundled scripts are plain Node, no dependencies).
- Internet access to load mermaid.js from the jsdelivr CDN when viewing a rendered file.

## License

MIT
