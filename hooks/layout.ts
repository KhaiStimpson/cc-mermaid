export type Segment = { kind: 'markdown'; text: string } | { kind: 'mermaid'; source: string; raw: string }

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
    if (source.trim()) segments.push({ kind: 'mermaid', source, raw: match[0] })
    else segments.push({ kind: 'markdown', text: match[0] })
    last = start + match[0].length
  }
  if (last < text.length) segments.push({ kind: 'markdown', text: text.slice(last) })
  return segments
}

// The widest line of a text drawing, in terminal cells (box-drawing glyphs
// are one cell each).
export function textWidth(drawing: string) {
  return Math.max(0, ...drawing.split('\n').map(line => [...line.trimEnd()].length))
}
