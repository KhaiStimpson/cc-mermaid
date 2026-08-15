---
description: Toggle whether rendered mermaid diagrams auto-open in your browser (on|off)
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.js"*)
---

Run the config script with the user's argument (`$ARGUMENTS`, expected to be `on` or `off`)
mapped to `true`/`false`:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.js" set auto-open $ARGUMENTS
```

If `$ARGUMENTS` is `on`, pass `true`; if `off`, pass `false`. If it's neither, run
`node "${CLAUDE_PLUGIN_ROOT}/scripts/config.js" get` instead and show the user the
current setting along with usage: `/cc-mermaid:mermaid-autoopen on` or `off`.
