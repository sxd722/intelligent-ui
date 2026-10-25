import { evaluate, safeKey } from './expression.mjs'
import { checkValue } from './registry.mjs'
import { validateToolInput } from './tools.mjs'
import {validateBusinessIds} from './dataflow.mjs'
import {liveDatasetContext} from './prefetch.mjs'
import {logicJson} from './logic-contract.mjs'

const scopeCaches=new WeakMap()

export function createStore() { return { values: Object.create(null), types: Object.create(null) } }
export function makeScope(spec, store, extra = {}) {
  const scope = { event: {}, args: {}, ...extra, data: Object.create(null), state: store.values, next: store.values, derived: Object.create(null), bindings:Object.create(null), context: liveDatasetContext(spec,extra.bindings) }
  const evaluating = new Set()
  const budget = { remaining: 20000 }
  const cache=new Map();let cacheReady=false
  const computed=(key,read)=>{
    if(cacheReady&&cache.has(key))return cache.get(key)
    const value=read()
    if(cacheReady)cache.set(key,value)
    return value
  }
  scopeCaches.set(scope,cache)
  for(const [id,binding] of Object.entries(spec.bindings||{}))Object.defineProperty(scope.bindings,id,{enumerable:true,get(){
    if(extra.bindings?.[id])return extra.bindings[id]
    const key=`bindings.${id}`;if(evaluating.has(key))throw new Error(`cyclic binding ${key}`)
    evaluating.add(key)
    try{return computed(key,()=>({value:evaluate(binding.initial,scope,budget),status:'idle',error:'',updatedAt:null}))}finally{evaluating.delete(key)}
  }})
  for (const [name, ast] of Object.entries(spec.data || {})) {
    Object.defineProperty(scope.data, name, { enumerable: true, get() {
      const key = `data.${name}`
      if (evaluating.has(key)) throw new Error(`cyclic binding ${key}`)
      evaluating.add(key)
      try { return computed(key,()=>evaluate(ast, scope, budget)) } finally { evaluating.delete(key) }
    } })
  }
  for (const [name, ast] of Object.entries(spec.derived || {})) {
    Object.defineProperty(scope.derived, name, { enumerable: true, get() {
      if (evaluating.has(name)) throw new Error(`cyclic derivation ${name}`)
      evaluating.add(name)
      try { return computed(`derived.${name}`,()=>evaluate(ast, scope, budget)) } finally { evaluating.delete(name) }
    } })
  }
  for (const [name, declaration] of Object.entries(spec.state || {})) {
    if (store.types[name] && store.types[name] !== declaration.type) throw new Error(`state type changed: ${name}`)
    if (!Object.hasOwn(store.values, name)) {
      let value = evaluate(declaration.initial, scope, budget)
      if (!checkValue(declaration.type, value)) throw new Error(`invalid initial state: ${name}`)
      if(spec.context?.expressionDialect==='js-v1')value=JSON.parse(logicJson(value))
      store.values[name] = structuredClone(value); store.types[name] = declaration.type
    }
  }
  // One render/response scope has immutable inputs. During initialization later
  // state declarations may still appear, so memoization starts only afterwards.
  cacheReady=true
  return scope
}
export function executeAction(spec, store, actionId, extra = {}) {
  const steps = spec.actions[actionId]
  if (!steps) throw new Error(`unknown action ${actionId}`)
  // All steps are transactional. A failed step cannot leave half-applied state.
  const draft = { values: structuredClone(store.values), types: { ...store.types } }
  // Legacy v1 reads the evolving draft. New cards explicitly opt into snapshot
  // reads: state/derived stay at action entry; next reads writes made so far.
  // All operands/keys share that contract. Operators still mutate the draft.
  makeScope(spec, draft, extra)
  const snapshot = { values: structuredClone(draft.values), types: { ...draft.types } }
  const entryScope = makeScope(spec, spec.actionMode === 'snapshot' ? snapshot : draft, extra)
  // Keep derived getter closures bound to their entry scope, even if a derived
  // expression explicitly references next. Only action operands see the draft.
  const scope = { ...entryScope, next: draft.values }, missingInputs = new Map()
  const budget = { remaining: 20000, onMissingInput: (root, key) => missingInputs.set(`${root}.${key}`, { root, key }) }
  const effects=[]
  for (const step of steps) {
    // Legacy sequential actions read each new draft. Snapshot actions keep
    // entry data/derivations, while explicit next reads bypass this cache.
    if(spec.actionMode!=='snapshot')scopeCaches.get(entryScope)?.clear()
    missingInputs.clear()
    const target = step.target
    if (step.when) {
      const condition = evaluate(step.when, scope, budget)
      if (typeof condition !== 'boolean') throw new Error(`action ${actionId}: when must evaluate to boolean`)
      if (!condition) continue
    }
    if(step.type==='invoke') {
      const binding=spec.bindings?.[step.binding]
      if(!binding)throw new Error(`unknown binding ${step.binding}`)
      const inputExpression=step.input||binding.input;let input=evaluate(inputExpression,scope,budget)
      if(spec.context?.expressionDialect==='js-v1')input=JSON.parse(logicJson(input))
      validateToolInput(binding.tool,input)
      if(binding.tool.startsWith('opencli.'))validateBusinessIds(input,extra.bindings)
      if(binding.tool==='glm.generate'&&step.target==='binding'&&!input.schema)throw new Error('GLM JSON requires input.schema')
      effects.push({...step,tool:binding.tool,inputExpression,input:structuredClone(input)})
      continue
    }
    if (!Object.hasOwn(draft.values, target)) throw new Error(`unknown state ${target}`)
    const value = step.value ? evaluate(step.value, scope, budget) : null
    const rawKey = step.key ? evaluate(step.key, scope, budget) : null
    if(step.key && !(typeof rawKey==='string'&&rawKey.length>0 || typeof rawKey==='number'&&Number.isFinite(rawKey)))
      throw new Error(`action ${actionId}: ${step.type}.key must resolve to a nonempty string or finite number, not ${String(rawKey)}; event fields: ${Object.keys(scope.event||{}).join(', ')||'none'}; args fields: ${Object.keys(scope.args||{}).join(', ')||'none'}. Use the supplied record ID rather than a missing event field.`)
    const key = step.key ? String(rawKey) : null
    let next = draft.values[target]
    if (key !== null && !safeKey(key)) throw new Error('forbidden state key')
    switch (step.type) {
      case 'set': next = key === null ? value : { ...next, [key]: value }; break
      case 'toggle': next = key === null ? !next : { ...next, [key]: !next?.[key] }; break
      case 'increment': next = Number(next) + Number(value ?? 1); break
      case 'append': if (!Array.isArray(next)) throw new Error('append requires array'); next = [...next, value]; break
      case 'update':
        if (!Array.isArray(next)) throw new Error('update requires array')
        next = next.map((item) => String(item.id) === key ? { ...item, ...value, id: item.id } : item); break
      case 'remove':
        if (!Array.isArray(next)) throw new Error('remove requires array')
        next = next.filter((item) => String(item.id) !== key); break
      default: throw new Error(`unknown action step ${step.type}`)
    }
    if (!checkValue(draft.types[target], next)) {
      const actual = next === null ? 'null' : Array.isArray(next) ? 'array' : typeof next
      const hints = [...missingInputs].map(([path, { root, key }]) => {
        const other = root === 'event' ? 'args' : 'event'
        const available = Object.keys(scope[root] || {}).join(', ') || 'none'
        const suggestion = scope[other] != null && Object.hasOwn(Object(scope[other]), key)
          ? `; ${other}.${key} is supplied, use ${other}.${key} for that parameter` : ''
        return `${path} is missing (available ${root} fields: ${available})${suggestion}`
      })
      throw new Error(`state type violation: ${target}; action ${actionId}, ${step.type} expected ${draft.types[target]}, received ${actual}${hints.length ? '; ' + hints.join('; ') : ''}`)
    }
    // A saved value owns its data, including objects received through args or
    // tool results. Later mutations outside this transaction cannot alter it.
    if(spec.context?.expressionDialect==='js-v1')next=JSON.parse(logicJson(next))
    draft.values[target] = structuredClone(next)
  }
  store.values = draft.values
  store.types = draft.types
  // This is an output buffer, never an executor: compiler probes stay pure.
  if(extra.effects)extra.effects.push(...effects)
  return store.values
}
