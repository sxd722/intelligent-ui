// One-off analyzer: parse the computed-styles dump (nested ELEMENT/STYLES tree)
// and emit a compact layout tree with the properties that matter for spatial planning.
import { readFileSync } from 'node:fs'

const src = readFileSync('C:/Users/USER/Downloads/descendants_styles.txt', 'utf8')
const lines = src.split('\n')

const KEY = new Set([
  'display', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'grid-template-columns', 'grid-template-rows', 'gap', 'row-gap', 'column-gap',
  'inline-size', 'block-size', 'width', 'height', 'min-inline-size', 'max-inline-size',
  'min-block-size', 'max-block-size', 'aspect-ratio', 'overflow-x', 'overflow-y',
  'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'font-size', 'line-height', 'font-weight',
  'text-overflow', 'white-space', '-webkit-line-clamp', 'justify-content', 'align-items',
  'border-radius', 'position', 'scroll-snap-type',
])

const elements = []
let cur = null
let indent = 0 // depth from ELEMENT line indentation
const stack = [] // indices of ancestors

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const m = /^(\s*)ELEMENT:\s*(.+)$/.exec(line)
  if (m) {
    const depth = Math.floor(m[1].length / 2)
    cur = {
      depth,
      selector: m[2].trim(),
      props: {},
      line: i + 1,
      parent: stack.length ? stack[stack.length - 1] : -1,
    }
    elements.push(cur)
    // maintain ancestor stack by depth
    while (stack.length && elements[stack[stack.length - 1]].depth >= depth) stack.pop()
    stack.push(elements.length - 1)
    continue
  }
  if (!cur) continue
  const p = /^\s*([-\w]+):\s*(.+?);\s*$/.exec(line)
  if (p && KEY.has(p[1])) cur.props[p[1]] = p[2]
}

// emit compact tree
const out = []
for (const e of elements) {
  const p = e.props
  const pad = (p['padding-top'] ?? '').replace(/^0px$/, '0') || undefined
  const pts = [p['padding-top'], p['padding-right'], p['padding-bottom'], p['padding-left']].map((v) => (v ?? '').replace(/^0px$/, '0'))
  const padStr = new Set(pts).size === 1 ? pts[0] : pts.join('/')
  const bits = []
  const d = p.display
  if (d && d !== 'block') bits.push(d)
  if (p['flex-direction'] && p['flex-direction'] !== 'row') bits.push(`dir=${p['flex-direction']}`)
  if (p['grid-template-columns']) bits.push(`cols=${p['grid-template-columns']}`)
  if (p.gap && p.gap !== 'normal') bits.push(`gap=${p.gap}`)
  if (p['justify-content'] && p['justify-content'] !== 'flex-start' && p['justify-content'] !== 'normal') bits.push(`jc=${p['justify-content']}`)
  const w = p['inline-size']
  const h = p['block-size']
  const fs = p['font-size']
  const lh = p['line-height']
  const fx = [p['flex-grow'], p['flex-shrink'], p['flex-basis']]
  if (fx.some((v) => v && v !== '0' && v !== '1' && v !== 'auto')) bits.push(`flex=${fx.join(' ')}`)
  if (p['overflow-y'] && p['overflow-y'] !== 'visible') bits.push(`oy=${p['overflow-y']}`)
  if (p['text-overflow'] && p['text-overflow'] !== 'clip') bits.push(`to=${p['text-overflow']}`)
  if (p['white-space'] && p['white-space'] !== 'normal') bits.push(`ws=${p['white-space']}`)
  if (p['aspect-ratio'] && p['aspect-ratio'] !== 'auto') bits.push(`ar=${p['aspect-ratio']}`)
  if (p['max-block-size'] && p['max-block-size'] !== 'none') bits.push(`maxH=${p['max-block-size']}`)
  if (p['min-block-size'] && p['min-block-size'] !== 'auto') bits.push(`minH=${p['min-block-size']}`)
  const padOut = padStr && padStr !== '0' ? ` pad=${padStr}` : ''
  out.push(
    `${'  '.repeat(e.depth)}${e.selector} [${w ?? '?'} × ${h ?? '?'}] fs=${fs ?? '?'}${lh ? ` lh=${lh}` : ''}${padOut}${bits.length ? '  ' + bits.join(' ') : ''}`
  )
}
console.log(out.join('\n'))
console.log(`\n// ${elements.length} elements parsed`)
