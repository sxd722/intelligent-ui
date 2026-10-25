// Replay bounded, data-driven cards through the same interpreter as the UI.
// This is a QA tool, not an automatic claim that arbitrary game rules are valid.
import { readFile, writeFile } from 'node:fs/promises'
import { compileCard } from '../shared/cardspec/compiler.mjs'
import { createStore, makeScope, executeAction } from '../shared/cardspec/store.mjs'
import { evaluate } from '../shared/cardspec/expression.mjs'
import { REGISTRY, checkValue } from '../shared/cardspec/registry.mjs'
import { validateWidget } from '../shared/cardspec/widgets.mjs'

const file = process.argv[2]
const resetAction = process.argv.find(a => a.startsWith('--reset-action='))?.split('=')[1]
if (!file) throw new Error('Pass a generated evaluation JSON file')
const record = JSON.parse(await readFile(file, 'utf8'))
const compiled = compileCard(record.source, { final: true, context: record.spec?.context || record.message?.metadata?.card_spec?.context })
if (!compiled.complete) throw new Error(JSON.stringify(compiled.diagnostics))
const spec = compiled.spec, initial = createStore()
makeScope(spec, initial)
function view(store) {
  const buttons = [], text = []
  const visit = (nodes, scope, path = '') => {
    for (const node of nodes) {
      const identity = `${path}/${node.id}`
      if (node.type === 'run') { text.push(String(evaluate(node.value, scope) ?? '')); continue }
      const p = Object.fromEntries(Object.entries(node.props).filter(([k]) => k !== 'args' && k !== 'itemKey').map(([k, v]) => [k, evaluate(v, scope)]))
      for (const [k, v] of Object.entries(p)) {
        const type = REGISTRY[node.type]?.props[k]
        if (type && !checkValue(type, v)) throw new Error(`${identity}.${k}: expected ${type}`)
      }
      if (p.visible === false || (node.type === 'if' && !p.test)) continue
      if (node.type === 'each') {
        const ids = new Set()
        for (const [index, item] of p.items.entries()) {
          const local = { ...scope, item, index, [p.as || 'item']: item }
          const key = evaluate(node.props.itemKey, local)
          if (key == null || ids.has(key)) throw new Error(`${identity}: duplicate/missing itemKey`)
          ids.add(key); visit(node.children, local, `${identity}/${encodeURIComponent(key)}`)
        }
        continue
      }
      validateWidget(node.type, p)
      for (const k of ['label', 'value']) if (p[k] != null && typeof p[k] !== 'object') text.push(String(p[k]))
      if (['button','pressable','chip'].includes(node.type) && p.onPress && !p.disabled) buttons.push({ identity, action: p.onPress, args: node.props.args ? evaluate(node.props.args, scope) : {} })
      visit(node.children || [], scope, identity)
    }
  }
  visit(spec.children, makeScope(spec, store))
  return { buttons, text: text.join(' | ') }
}
const key = store => JSON.stringify(store.values)
const initialKey = key(initial), seen = new Set(), queue = [{ store: initial, path: [] }]
const endings = new Map(), errors = [], transitions = [], resetDifferences = [], maxDepth = 20, maxStates = 2000
let bounded = true
while (queue.length && seen.size < maxStates) {
  const { store, path } = queue.shift(), stateKey = key(store)
  if (seen.has(stateKey)) continue
  seen.add(stateKey)
  try {
    const current = view(store), nextStates = []
    for (const button of current.buttons) {
      const next = structuredClone(store)
      executeAction(spec, next, button.action, { args: button.args })
      // Always validate reset and post-action render, including final rounds.
      view(next)
      const nextKey = key(next)
      transitions.push({ from: stateKey, action: button.action, args: button.args, to: nextKey })
      if (button.action === resetAction) {
        if (nextKey !== initialKey) resetDifferences.push({ path, state: next.values })
        continue
      }
      if (nextKey !== initialKey && nextKey !== stateKey) nextStates.push({ store: next, path: [...path, { identity: button.identity, action: button.action, args: button.args }] })
    }
    if (stateKey !== initialKey && !nextStates.length) endings.set(current.text, { state: store.values, path })
    if (path.length >= maxDepth && nextStates.length) bounded = false
    else queue.push(...nextStates)
  } catch (error) { errors.push({ path, state: store.values, error: error.message }) }
}
if (queue.length) bounded = false
const report = { file, states: seen.size, transitions: transitions.length, bounded, errors, resetDifferences, endings: [...endings].map(([text, value]) => ({ text, ...value })) }
await writeFile(file.replace(/\.json$/, '-exploration.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ file, states: seen.size, transitions: transitions.length, bounded, errors: errors.slice(0, 3), resetDifferences: resetDifferences.length, endingStates: endings.size }))
if (errors.length || resetDifferences.length || !bounded || !endings.size) process.exitCode = 1
