---
description: Use PROACTIVELY every time you write a ```mermaid code block in a response. Renders the diagram to a viewable HTML file and returns a link/path to append under the code block, so the user can open it in a browser instead of reading raw mermaid source.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/render.js"*)
---

# Render Mermaid Diagram

Whenever you include a ` ```mermaid ` code block anywhere in your response, immediately
after writing it, run the bundled render script to produce a viewable HTML file, then
append a link to it right under the code block in your reply.

## How to call it

Pass the exact mermaid source (everything between the ` ```mermaid ` and ` ``` ` fences,
not the fences themselves) on stdin via a heredoc:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/render.js" <<'MERMAID_EOF'
graph TD
  A --> B
MERMAID_EOF
```

The script prints three lines to stdout:

```
PATH: C:/Users/you/.claude/cc-mermaid/renders/diagram-<hash>.html
URL: file:///C:/Users/you/.claude/cc-mermaid/renders/diagram-<hash>.html
OPENED: true|false
```

## What to do with the output

- Append a markdown link using the `URL:` value, e.g.:
  `[🔗 View rendered diagram](file:///C:/Users/you/.claude/cc-mermaid/renders/diagram-abc123.html)`
- Many chat clients (browser-based UIs, the desktop/web app) block navigation to
  `file://` links for security — clicking does nothing there even though the link
  renders. So also print the plain `PATH:` value on its own line in an inline code
  span right after the link, e.g. `` `C:\Users\you\.claude\cc-mermaid\renders\diagram-abc123.html` ``,
  so the user can copy it and paste it into their browser's address bar if the link
  doesn't open.
- If `OPENED: true`, mention briefly that it was opened in the browser automatically
  (auto-open is a user-controlled setting, toggled via `/cc-mermaid:mermaid-autoopen`).
  If `OPENED: false`, you can mention `/cc-mermaid:mermaid-autoopen on` as a way to
  skip needing to click/paste the link every time.
- If the script errors, don't block your response on it — just show the mermaid code
  block as normal and skip the link.
- Do this for every mermaid block if a response contains more than one diagram.
- Never invoke this for non-mermaid code blocks.
