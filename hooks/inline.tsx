import type { EngineInterface, Register, RenderElement, RenderInput } from 'claude-code'

import { imageCells, MAX_SVG_CHARS, splitMermaid } from './layout'
import { RENDER_SCRIPT } from './renderScript'

// Draws ```mermaid blocks in assistant replies as diagrams, inline in the
// transcript: an Svg on the Desktop app, VS Code and mobile, and an Image on
// terminals that speak the kitty graphics protocol (kitty, Ghostty). Anywhere
// else, or while a diagram is still rendering or failed to, the reply is drawn
// exactly as Claude Code would, so the skill's HTML link stays the fallback.

type Settings = { renderer: string; theme: string; terminalImages: string }

type Rendered = { path: string; width?: number; height?: number; svg?: string }

type Entry =
  | { status: 'pending' }
  | { status: 'done'; result: Rendered }
  | { status: 'failed'; reason: string }

type Format = 'svg' | 'png'

// Rendered diagrams by format and source. The host keeps the files as well, so
// a reload of this module only pays for re-reading them.
const cache = new Map<string, Entry>()
let kittyTerminal: Promise<boolean> | undefined

async function detectKittyGraphics($: EngineInterface) {
  const term = (await $.env.get('TERM')) ?? ''
  const program = ((await $.env.get('TERM_PROGRAM')) ?? '').toLowerCase()
  return (
    term.includes('kitty') ||
    term.includes('ghostty') ||
    program === 'ghostty' ||
    (await $.env.get('KITTY_WINDOW_ID')) !== undefined ||
    (await $.env.get('GHOSTTY_RESOURCES_DIR')) !== undefined
  )
}

function supportsTerminalImages($: EngineInterface, settings: Settings) {
  if (settings.terminalImages === 'always') return Promise.resolve(true)
  if (settings.terminalImages === 'never') return Promise.resolve(false)
  kittyTerminal ??= detectKittyGraphics($)
  return kittyTerminal
}

async function renderOnHost($: EngineInterface, key: string, format: Format, source: string, settings: Settings) {
  try {
    const ran = await $.process.run(['node', '-e', RENDER_SCRIPT, '--', format, settings.renderer, settings.theme], {
      stdin: source,
      timeoutMs: 90_000,
    })
    if (ran.exitCode !== 0) throw new Error(ran.stderr.trim() || `exit ${ran.exitCode}`)
    const result: Rendered = JSON.parse(ran.stdout.trim().split('\n').pop() ?? '')
    cache.set(key, { status: 'done', result })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    cache.set(key, { status: 'failed', reason })
    $.ui.log(`cc-mermaid: inline render failed: ${reason}`, { to: 'debug' })
  }
  $.ui.invalidate('ui.render')
}

// The cached render, or a pending entry while one starts in the background;
// its completion redraws the transcript.
function lookup($: EngineInterface, format: Format, source: string, settings: Settings): Entry {
  const key = `${format}\0${source}`
  const known = cache.get(key)
  if (known) return known
  cache.set(key, { status: 'pending' })
  void renderOnHost($, key, format, source, settings)
  return { status: 'pending' }
}

function isDrawable(entry: Entry | undefined, format: Format) {
  if (entry === undefined) return true
  if (entry.status !== 'done') return false
  return format === 'png' || (entry.result.svg ?? '').length <= MAX_SVG_CHARS
}

function drawMarkdown($: EngineInterface, e: RenderInput<'AssistantMessage'>, text: string, key: string) {
  const { Markdown } = $.ui.resolve(e)
  return <Markdown key={key} text={text.replace(/^\n+|\n+$/g, '')} />
}

function drawDiagram($: EngineInterface, e: RenderInput<'AssistantMessage'>, result: Rendered, alt: string, key: string) {
  if (e.surface === 'terminal') {
    const { Image } = $.ui.resolve(e)
    const maxColumns = Math.max(20, (e.viewport?.columns ?? 100) - 4)
    const { columns, rows } = imageCells(result.width ?? 800, result.height ?? 600, maxColumns)
    return <Image key={key} source={{ file: result.path, format: 'png' }} columns={columns} rows={rows} alt={alt} />
  }
  const { Svg } = $.ui.resolve(e)
  return <Svg source={result.svg ?? ''} alt={alt} />
}

export const register: Register = (on, options) => {
  const settings: Settings = {
    renderer: ['mermaid.ink', 'mmdc', 'off'].includes(String(options.renderer)) ? String(options.renderer) : 'mermaid.ink',
    theme: ['default', 'dark', 'neutral', 'forest'].includes(String(options.theme)) ? String(options.theme) : 'default',
    terminalImages: String(options.terminalImages ?? 'auto'),
  }

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (settings.renderer === 'off') return next(e)

    const segments = splitMermaid(e.props.text)
    if (!segments.some(s => s.kind === 'mermaid')) return next(e)

    const isTerminal = e.surface === 'terminal'
    if (isTerminal && !(await supportsTerminalImages($, settings))) return next(e)

    // Every diagram renders before any is drawn, so a reply never shows half
    // its diagrams as code and half as pictures.
    const format: Format = isTerminal ? 'png' : 'svg'
    const entries = segments.map(s => (s.kind === 'mermaid' ? lookup($, format, s.source, settings) : undefined))
    if (!entries.every(entry => isDrawable(entry, format))) return next(e)

    const children: (RenderElement | string)[] = []
    for (const [i, segment] of segments.entries()) {
      const entry = entries[i]
      if (segment.kind === 'mermaid') {
        if (entry?.status !== 'done') continue
        const alt = `Mermaid diagram: ${(segment.source.split('\n')[0] ?? '').trim()}`
        children.push(drawDiagram($, e, entry.result, alt, `diagram-${i}`))
      } else if (segment.text.trim()) {
        // The lead text goes through the engine's own drawing, keeping the
        // reply's bullet; later text is drawn the same way a reply's is.
        children.push(
          i === 0 ? await next({ ...e, props: { ...e.props, text: segment.text } }) : drawMarkdown($, e, segment.text, `md-${i}`),
        )
      }
    }

    const { Box } = $.ui.resolve(e)
    return <Box flexDirection="column">{children}</Box>
  })
}
