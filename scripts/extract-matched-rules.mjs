// Extract unique stylesheet rules for DIL classes from devtools_matched_styles.txt
import { readFileSync } from 'node:fs'

const src = readFileSync('C:/Users/USER/Downloads/devtools_matched_styles.txt', 'utf8')
const DIL = /(Box-|Grid-|Item-|Pressable-|Text-|TextBase-|Title-|Caption-|Badge-|Button-|ButtonInner|SegmentedControl|Divider-|FaviconBox-|Image-|Trigger-)/

// --- collect all CSS rule blocks (selector { decls }) anywhere in the file ---
// rules are indented; selectors may be comma lists; @media wrappers appear as
// "@media ... {" lines containing nested rules (handle one nesting level).
const rules = new Map() // key: selector+decls -> {selector, decls, contexts}
let ctx = [] // media contexts stack
let buf = null // {selector, lines}
let depth = 0

function flush() {
  if (!buf) return
  const decls = buf.lines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('/*'))
  const sel = buf.selector.trim()
  // skip noise: tailwind preflight on universal selectors, pure custom-prop dumps
  const isNoise =
    sel === '*' ||
    sel.startsWith('*,') ||
    sel.startsWith('::') ||
    (decls.length > 0 && decls.every((d) => /^\s*--(tw|.*-)/.test(d) && !/[^-\w]--tw/.test(d) === false && /:\s*[^;]*;?$/.test(d) && d.startsWith('--')))
  if (!isNoise && decls.length) {
    const key = sel + '::' + decls.join('|')
    if (!rules.has(key)) {
      rules.set(key, { selector: sel, decls, context: ctx.join(' && ') })
    }
  }
  buf = null
}

for (const raw of src.split('\n')) {
  const line = raw.trim()
  if (!line) continue
  if (line.startsWith('ELEMENT:') || line.startsWith('MATCHED RULES:') || line === '--------------------------------------------------') {
    flush()
    if (line.startsWith('ELEMENT:')) ctx = []
    continue
  }
  if (line.startsWith('@media') || line.startsWith('@supports')) {
    flush()
    ctx.push(line)
    continue
  }
  if (line === '}' || line === '{') {
    if (line === '}' && ctx.length && depth === 0) ctx.pop()
    continue
  }
  if (line.endsWith('{')) {
    flush()
    buf = { selector: line.slice(0, -1).trim(), lines: [] }
    continue
  }
  if (buf) buf.lines.push(raw)
  if (line.endsWith(';')) {
    // declaration line — keep buffering
  }
}
flush()

// filter to DIL-relevant rules and print grouped
const dil = [...rules.values()].filter((r) => DIL.test(r.selector))
const seen = new Set()
for (const r of dil) {
  const key = r.selector + '::' + r.decls.join('|')
  if (seen.has(key)) continue
  seen.add(key)
  console.log(`${r.context ? `[${r.context}] ` : ''}${r.selector} {`)
  for (const d of r.decls) console.log(`    ${d}`)
  console.log(`}`)
}
console.log(`\n// ${dil.length} DIL rules (${rules.size} total non-noise rules)`)
