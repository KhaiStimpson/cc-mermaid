import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

type RunResult = { exitCode: number; stdout: string; stderr: string }

const ran = (r: RunResult) => ({ value: { ...r, isStdoutTruncated: false, isStderrTruncated: false } })

// Stands in for the engine beneath the plugin: its own drawing of a reply
// (a Markdown), the debug log, the environment and the host render script.
function engine(on: On, run: (format: string) => RunResult, env: Record<string, string> = {}, toasts: string[] = []) {
  const formats: string[] = []
  mock.env(on, env)
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Markdown } = $.ui.resolve(e)
    return Markdown({ key: 'engine', text: e.props.text })
  })
  on('process.run', ($, e) => {
    const format = String(e.argv[4])
    formats.push(format)
    return ran(run(format))
  })
  return formats
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'

const REPLY = [
  'Here is the flow:',
  '',
  '```mermaid',
  'graph TD',
  '  A --> B',
  '```',
  '',
  'And that is it.',
].join('\n')

const props = (text: string) => ({ text, isFirstOfReply: true })

test('a mermaid block is drawn as an Svg once rendered, on remote surfaces', async ($, on) => {
  const runs = engine(on, () => ({ exitCode: 0, stdout: JSON.stringify({ path: '/tmp/d.svg', svg: SVG }) + '\n', stderr: '' }))

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface, component: 'AssistantMessage', props: props(REPLY) })
    await ui.redraw()
    const svg = await ui.find({ type: 'Svg' })
    expect(svg).toBeDefined()
    expect(await ui.find({ type: 'Markdown', text: /And that is it/ })).toBeDefined()
    await ui.unmount()
  }
  // One render serves every surface and redraw.
  expect(runs).toEqual(['svg'])
})

test('a reply without mermaid is left to the engine', async ($, on) => {
  const runs = engine(on, () => ({ exitCode: 0, stdout: '', stderr: '' }))
  const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'desktop', component: 'AssistantMessage', props: props('```js\nx\n```') })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(runs).toEqual([])
  await ui.unmount()
})

test('a failed render keeps the code block', async ($, on) => {
  engine(on, () => ({ exitCode: 1, stdout: '', stderr: 'Error: Parse error on line 2' }))
  const ui = await $.ui.mount({
    plugin: 'cc-mermaid',
    surface: 'desktop',
    component: 'AssistantMessage',
    props: props('```mermaid\ngraph LR\n  X --> Y\n```'),
  })
  await ui.redraw()
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Markdown', text: /```mermaid/ })).toBeDefined()
  await ui.unmount()
})

test('the terminal leaves the reply alone outside kitty and Ghostty', async ($, on) => {
  const runs = engine(on, () => ({ exitCode: 0, stdout: '', stderr: '' }))
  const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'terminal', component: 'AssistantMessage', props: props(REPLY) })
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect(runs).toEqual([])
  await ui.unmount()
})

test('the terminal draws an Image when images are forced on', { options: { terminalImages: 'always' } }, async ($, on) => {
  engine(on, () => ({ exitCode: 0, stdout: JSON.stringify({ path: '/tmp/d.png', width: 400, height: 300 }) + '\n', stderr: '' }))
  const ui = await $.ui.mount({
    plugin: 'cc-mermaid',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: props('```mermaid\ngraph TD\n  P --> Q\n```'),
    viewport: { columns: 120, rows: 40 },
  })
  await ui.redraw()
  expect(await ui.find({ type: 'Image' })).toBeDefined()
  await ui.unmount()
})

test('kitty is detected from the environment', async ($, on) => {
  engine(on, () => ({ exitCode: 0, stdout: JSON.stringify({ path: '/tmp/k.png', width: 200, height: 100 }) + '\n', stderr: '' }), {
    TERM: 'xterm-kitty',
  })
  const ui = await $.ui.mount({
    plugin: 'cc-mermaid',
    surface: 'terminal',
    component: 'AssistantMessage',
    props: props('```mermaid\nsequenceDiagram\n  A->>B: hi\n```'),
  })
  await ui.redraw()
  expect(await ui.find({ type: 'Image' })).toBeDefined()
  await ui.unmount()
})

test('a missing mermaid-cli says how to install it, once', async ($, on) => {
  const toasts: string[] = []
  engine(on, () => ({ exitCode: 1, stdout: '', stderr: 'MMDC_NOT_FOUND\n' }), {}, toasts)
  for (const body of ['graph TD\n  M --> N', 'graph TD\n  O --> P']) {
    const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'desktop', component: 'AssistantMessage', props: props('```mermaid\n' + body + '\n```') })
    await ui.redraw()
    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    await ui.unmount()
  }
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('@mermaid-js/mermaid-cli')
})

test('inline drawing can be switched off', { options: { inline: false } }, async ($, on) => {
  const runs = engine(on, () => ({ exitCode: 0, stdout: '', stderr: '' }))
  const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'desktop', component: 'AssistantMessage', props: props(REPLY) })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(runs).toEqual([])
  await ui.unmount()
})

test('a custom mmdc path reaches the render script', { options: { mmdcPath: '/opt/tools/mmdc' } }, async ($, on) => {
  let argv: readonly string[] = []
  on('ui.log', () => ({ value: undefined }))
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => $.ui.resolve(e).Markdown({ text: e.props.text }))
  on('process.run', ($, e) => {
    argv = e.argv
    return ran({ exitCode: 0, stdout: JSON.stringify({ path: '/tmp/c.svg', svg: SVG }) + '\n', stderr: '' })
  })
  const ui = await $.ui.mount({ plugin: 'cc-mermaid', surface: 'vscode', component: 'AssistantMessage', props: props('```mermaid\ngraph TD\n  C --> D\n```') })
  await ui.redraw()
  expect(argv.slice(3)).toEqual(['--', 'svg', 'default', '/opt/tools/mmdc'])
  await ui.unmount()
})
