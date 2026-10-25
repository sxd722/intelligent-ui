// Cross-validate: pair matched_dev_styles.txt (inline styles per element, DFS order)
// with descendants_styles.txt (computed styles per element, DFS order) and derive
// the HOST stylesheet contribution = computed − inline, per unique class signature.
import { readFileSync } from 'node:fs'

const KEY = [
  'display', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'grid-template-columns', 'grid-template-rows', 'gap', 'row-gap', 'column-gap',
  'inline-size', 'block-size', 'min-inline-size', 'max-inline-size',
  'min-block-size', 'max-block-size', 'aspect-ratio', 'overflow-x', 'overflow-y',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'font-size', 'line-height', 'font-weight', 'letter-spacing',
  'text-overflow', 'white-space', 'justify-content', 'align-items', 'align-self',
  'border-radius', 'position', 'color', 'background-color',
]

function parseMatched(src) {
  const els = []
  let cur = null
  for (const line of src.split('\n')) {
    const e = /^(\s*)ELEMENT:\s*(.+)$/.exec(line)
    if (e) {
      cur = { selector: e[2].trim(), inline: {} }
      els.push(cur)
      continue
    }
    const p = /^\s*([-\w]+):\s*(.*?);\s*$/.exec(line)
    if (p && cur) cur.inline[p[1]] = p[2]
  }
  return els
}

function parseComputed(src) {
  const els = []
  let cur = null
  for (const line of src.split('\n')) {
    const e = /^(\s*)ELEMENT:\s*(.+)$/.exec(line)
    if (e) {
      cur = { selector: e[2].trim(), computed: {} }
      els.push(cur)
      continue
    }
    const p = /^\s*([-\w]+):\s*(.+?);\s*$/.exec(line)
    if (p && cur && KEY.includes(p[1])) cur.computed[p[1]] = p[2]
  }
  return els
}

const matched = parseMatched(readFileSync('C:/Users/USER/Downloads/matched_dev_styles.txt', 'utf8'))
const computed = parseComputed(readFileSync('C:/Users/USER/Downloads/descendants_styles.txt', 'utf8'))

// align: matched skips svg internals — pair by selector sequence with a moving pointer
let ci = 0
const pairs = []
for (const m of matched) {
  // find next computed element whose selector contains all classes of m
  let j = ci
  while (j < computed.length && !computed[j].selector.includes(m.selector.split('.').slice(1).every ? '' : '')) j++
  // simple: advance until selectors match on primary class
  const mClasses = m.selector.split('.').slice(1)
  while (j < computed.length) {
    const cClasses = computed[j].selector.split('.').slice(1)
    if (mClasses.every((c) => cClasses.includes(c))) break
    j++
  }
  if (j < computed.length) {
    pairs.push({ m, c: computed[j] })
    ci = j + 1
  }
}

// derive host contribution per unique class-signature
const byClass = new Map()
for (const { m, c } of pairs) {
  const classes = m.selector.split('.').slice(1).sort().join('.')
  if (!byClass.has(classes)) byClass.set(classes, [])
  byClass.get(classes).push({ m, c })
}

for (const [classes, list] of byClass) {
  console.log(`\n=== ${classes}  (n=${list.length}) ===`)
  // union of computed keys that are NEVER in inline → host rule candidates
  const hostProps = {}
  const inlineProps = {}
  for (const { m, c } of list) {
    for (const [k, v] of Object.entries(c.computed)) {
      const iv = m.inline[k]
      // host sets it if inline missing AND value non-default-ish across instances
      if (iv === undefined || iv === '') {
        hostProps[k] = hostProps[k] || new Map()
        hostProps[k].set(v, (hostProps[k].get(v) ?? 0) + 1)
      } else {
        inlineProps[k] = inlineProps[k] || new Set()
        inlineProps[k].add(iv)
      }
    }
  }
  const host = Object.entries(hostProps)
    .filter(([k, vals]) => {
      // stable across all instances (likely a class rule), or a small set (attr-variant)
      return vals.size <= 4
    })
    .map(([k, vals]) => `  ${k}: ${[...vals.entries()].map(([v, n]) => `${v}×${n}`).join(' | ')}`)
  console.log(host.join('\n') || '  (all key props inline-driven)')
}
console.log(`\n// paired ${pairs.length}/${matched.length} elements`)
