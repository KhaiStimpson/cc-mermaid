export type Segment = { kind: 'markdown'; text: string } | { kind: 'mermaid'; source: string }

// Only closed fences: a block still streaming in stays plain text until done.
const MERMAID_FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*mermaid[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*$/gm

// The Svg element's own bound on its markup.
export const MAX_SVG_CHARS = 131072

export function splitMermaid(text: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const match of text.matchAll(MERMAID_FENCE)) {
    const start = match.index ?? 0
    if (start > last) segments.push({ kind: 'markdown', text: text.slice(last, start) })
    const indent = match[1] ?? ''
    const source = (match[3] ?? '')
      .split('\n')
      .map(line => (line.startsWith(indent) ? line.slice(indent.length) : line))
      .join('\n')
    if (source.trim()) segments.push({ kind: 'mermaid', source })
    last = start + match[0].length
  }
  if (last < text.length) segments.push({ kind: 'markdown', text: text.slice(last) })
  return segments
}

// Terminal cells are roughly twice as tall as they are wide.
export function imageCells(width: number, height: number, maxColumns: number) {
  let columns = Math.max(10, Math.min(255, maxColumns, Math.ceil(width / 8)))
  let rows = Math.max(1, Math.round((columns * height) / width / 2))
  if (rows > 255) {
    columns = Math.max(1, Math.floor((255 * 2 * width) / height))
    rows = 255
  }
  return { columns, rows }
}
