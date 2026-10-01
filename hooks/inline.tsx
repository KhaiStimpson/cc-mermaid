import type { EngineInterface, Register, RenderElement, RenderInput } from 'claude-code'

import { MAX_SVG_CHARS, splitMermaid, textWidth } from './layout'

// Draws ```mermaid blocks in assistant replies as diagrams, inline in the
// transcript: an SVG on the Desktop app, VS Code and mobile, and a Unicode
// box-drawing diagram in the terminal. Rendering is beautiful-mermaid, bundled
// with the plugin and run by scripts/render-inline.mjs: no browser, nothing to
// install, nothing leaves the machine. A diagram it cannot draw (an
// unsupported type, a parse error, too wide for the terminal) keeps its code
// block, and the skill's HTML link.

type Settings = { enabled: boolean; theme: string }

type Kind = 'svg' | 'ascii'

type Entry = { status: 'pending' } | { status: 'done'; out: string } | { status: 'failed'; reason: string }

const THEMES = [
  'zinc-light', 'zinc-dark', 'tokyo-night', 'tokyo-night-storm', 'tokyo-night-light', 'catppuccin-mocha',
  'catppuccin-latte', 'nord', 'nord-light', 'dracula', 'github-light', 'github-dark', 'solarized-light',
  'solarized-dark', 'one-dark',
]

// Drawings by kind, theme and source, so a redraw (a scroll, a resize) never
// renders a diagram twice.
const cache = new Map<string, Entry>()

type Components = ReturnType<EngineInterface['ui']['resolve']>

type RunResult = { stdout: string; stderr: string; exitCode: number | null }

const cacheKey = (source: string, kind: Kind, theme: string) => `${kind}\0${theme}\0${source}`

// Files a finished background render in the cache; returns why it failed, if
// it did, for the debug log.
function settle(key: string, ran: RunResult | undefined, error?: unknown): string | undefined {
  try {
    if (!ran) throw error
    const result = JSON.parse(ran.stdout.trim().split('\n').pop() || '{}')
    if (result.ok !== true) throw new Error(result.reason || ran.stderr.trim() || `exit ${ran.exitCode}`)
    cache.set(key, { status: 'done', out: String(result.out) })
    return undefined
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    cache.set(key, { status: 'failed', reason })
    return reason
  }
}

// `auto` follows Claude Code's own theme setting, light or dark.
function themeName(chosen: string, current: string) {
  if (THEMES.includes(chosen)) return chosen
  return current.includes('light') ? 'zinc-light' : 'zinc-dark'
}

function drawDiagram(ui: Components, e: RenderInput<'AssistantMessage'>, source: string, out: string, key: string) {
  if (e.surface === 'terminal') {
    const room = (e.viewport?.columns ?? 100) - 4
    if (textWidth(out) > room) return undefined
    const { Text } = ui
    return <Text key={key}>{out.replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '')}</Text>
  }
  if (out.length > MAX_SVG_CHARS) return undefined
  const alt = `Mermaid diagram: ${(source.split('\n')[0] ?? '').trim()}`
  const { Svg } = ui
  return <Svg source={out} alt={alt} />
}

function drawMarkdown(ui: Components, text: string, key: string) {
  const { Markdown } = ui
  return <Markdown key={key} text={text.replace(/^\n+|\n+$/g, '')} />
}

export const register: Register = (on, options) => {
  const settings: Settings = {
    enabled: options.inline !== false,
    theme: String(options.theme ?? 'auto'),
  }

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!settings.enabled) return next(e)

    const segments = splitMermaid(e.props.text)
    if (!segments.some(s => s.kind === 'mermaid')) return next(e)

    const kind: Kind = e.surface === 'terminal' ? 'ascii' : 'svg'
    let theme = ''
    if (kind === 'svg') {
      const rows = THEMES.includes(settings.theme) ? [] : await $.config.list()
      theme = themeName(settings.theme, String(rows.find(row => row.key === 'theme')?.value ?? 'dark'))
    }

    // The cached drawing, or a pending entry while one renders in the
    // background; its completion redraws the transcript.
    const entries = segments.map((s): Entry | undefined => {
      if (s.kind !== 'mermaid') return undefined
      const key = cacheKey(s.source, kind, theme)
      const known = cache.get(key)
      if (known) return known
      cache.set(key, { status: 'pending' })
      $.process
        .run(['node', `${$.plugin.root}/scripts/render-inline.mjs`], {
          stdin: JSON.stringify({ source: s.source, kind, theme }),
          timeoutMs: 30_000,
        })
        .then(
          ran => settle(key, ran),
          err => settle(key, undefined, err),
        )
        .then(reason => {
          if (reason) $.ui.log(`cc-mermaid: diagram not drawn inline: ${reason}`, { to: 'debug' })
          $.ui.invalidate('ui.render')
        })
      return { status: 'pending' }
    })
    // Every diagram settles before any is drawn, so a reply never flips
    // between code and pictures one diagram at a time.
    if (entries.some(entry => entry?.status === 'pending')) return next(e)

    const ui = $.ui.resolve(e)
    const diagrams = segments.map((s, i) => {
      const entry = entries[i]
      return s.kind === 'mermaid' && entry?.status === 'done' ? drawDiagram(ui, e, s.source, entry.out, `diagram-${i}`) : undefined
    })
    if (diagrams.every(d => d === undefined)) return next(e)

    const children: (RenderElement | string)[] = []
    for (const [i, segment] of segments.entries()) {
      const diagram = diagrams[i]
      if (diagram) {
        children.push(diagram)
        continue
      }
      // Text, or a diagram that keeps its code block.
      const text = segment.kind === 'mermaid' ? segment.raw : segment.text
      if (!text.trim()) continue
      // The lead text goes through the engine's own drawing, keeping the
      // reply's bullet; later text is drawn the same way a reply's is.
      children.push(i === 0 ? await next({ ...e, props: { ...e.props, text } }) : drawMarkdown(ui, text, `md-${i}`))
    }

    const { Box } = ui
    return <Box flexDirection="column">{children}</Box>
  })
}
