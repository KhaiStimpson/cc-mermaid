import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
const ASCII = '┌───┐     ┌───┐\n│ A ├────►│ B │\n└───┘     └───┘'

const REPLY = ['Here is the flow:', '', '```mermaid', 'graph TD', '  A --> B', '```', '', 'And that is it.'].join('\n')

const props = (text: string) => ({ text, isFirstOfReply: true })

type Request = { source: string; kind: string; theme: string }
type Answer = { ok: true; out: string } | { ok: false; reason: string }

// Stands in for the engine beneath the plugin: its own drawing of a reply (a
// Markdown), the debug log, the theme setting and the host render script.
function engine(on: On, answer: (request: Request) => Answer, theme = 'dark') {
  const requests: (Request & { argv: readonly string[] })[] = []
  on('ui.log', () => ({ value: undefined }))
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => $.ui.resolve(e).Markdown({ key: 'engine', text: e.props.text }))
  on('config.list', () => ({ value: [{ key: 'theme', value: theme }] }) as never)
  on('process.run', ($, e) => {
    const request: Request = JSON.parse(e.init?.stdin ?? '{}')
    requests.push({ ...request, argv: e.argv })
    const stdout = JSON.stringify(answer(request)) + '\n'
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return requests
}

const drawn = (request: Request): Answer => ({ ok: true, out: request.kind === 'svg' ? SVG : ASCII })

test('a mermaid block is drawn as an Svg on remote surfaces, rendered once', async ($, on) => {
  const requests = engine(on, drawn)
  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface, component: 'AssistantMessage', props: props(REPLY) })
    await ui.redraw()
    expect(await ui.find({ type: 'Svg' })).toBeDefined()
    expect(await ui.find({ type: 'Markdown', text: /```mermaid/ })).toBeUndefined()
    expect(await ui.find({ type: 'Markdown', text: /And that is it/ })).toBeDefined()
    await ui.unmount()
  }
  expect(requests.length).toBe(1)
  expect(requests[0]?.kind).toBe('svg')
  expect(requests[0]?.source).toBe('graph TD\n  A --> B')
  expect(requests[0]?.argv[0]).toBe('node')
  expect(requests[0]?.argv[1]).toMatch(/scripts\/render-inline\.mjs$/)
})

test('the terminal draws the diagram as text', async ($, on) => {
  const requests = engine(on, drawn)
  const ui = await $.ui.mount({
    plugin: 'cc-mermaid',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: props(REPLY),
    viewport: { columns: 100, rows: 40 },
  })
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /│ A ├────►│ B │/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /```mermaid/ })).toBeUndefined()
  expect(requests.map(r => r.kind)).toEqual(['ascii'])
  await ui.unmount()
})

test('a diagram too wide for the terminal keeps its code block', async ($, on) => {
  engine(on, () => ({ ok: true, out: '─'.repeat(200) }))
  const ui = await $.ui.mount({
    plugin: 'cc-mermaid',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: props('```mermaid\ngraph LR\n  W --> X\n```'),
    viewport: { columns: 80, rows: 40 },
  })
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /────/ })).toBeUndefined()
  expect(await ui.find({ type: 'Markdown', text: /```mermaid/ })).toBeDefined()
  await ui.unmount()
})

test('an unsupported diagram keeps its code block beside one that draws', async ($, on) => {
  engine(on, request => (request.source.startsWith('pie') ? { ok: false, reason: 'Invalid mermaid header: "pie"' } : drawn(request)))
  const text = ['Two charts:', '', '```mermaid', 'pie', '  "a": 1', '```', '', '```mermaid', 'graph TD', '  K --> L', '```'].join('\n')
  const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'desktop', component: 'AssistantMessage', props: props(text) })
  await ui.redraw()
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /```mermaid\npie/ })).toBeDefined()
  await ui.unmount()
})

test('a reply without mermaid is left to the engine', async ($, on) => {
  const requests = engine(on, drawn)
  const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'desktop', component: 'AssistantMessage', props: props('```js\nx\n```') })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(requests).toEqual([])
  await ui.unmount()
})

test('the theme follows a light Claude Code theme', async ($, on) => {
  const requests = engine(on, drawn, 'light-daltonized')
  const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'desktop', component: 'AssistantMessage', props: props('```mermaid\ngraph TD\n  T --> U\n```') })
  await ui.redraw()
  expect(requests[0]?.theme).toBe('zinc-light')
  await ui.unmount()
})

test('a chosen theme is used as is', { options: { theme: 'dracula' } }, async ($, on) => {
  const requests = engine(on, drawn, 'light')
  const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'vscode', component: 'AssistantMessage', props: props('```mermaid\ngraph TD\n  G --> H\n```') })
  await ui.redraw()
  expect(requests[0]?.theme).toBe('dracula')
  await ui.unmount()
})

test('inline drawing can be switched off', { options: { inline: false } }, async ($, on) => {
  const requests = engine(on, drawn)
  const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'desktop', component: 'AssistantMessage', props: props(REPLY) })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(requests).toEqual([])
  await ui.unmount()
})
