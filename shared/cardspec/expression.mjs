import {parseJavaScriptExpression,evaluateJavaScriptExpression} from './javascript-expression.mjs'
// Versioned expression languages. Source is never evaluated in the host realm.
const blocked = new Set(['__proto__', 'prototype', 'constructor'])
export const safeKey = (key) => typeof key === 'string' && !blocked.has(key)
const literal = (value) => ({ type: 'literal', value })
// Accept paired typographic delimiters only where a string token starts.
// Never globally replace punctuation inside prose or ASCII-quoted strings.
export const quoteEnd = c => ({ '"':'"', "'":"'", '“':'”', '‘':'’' })[c]
const precedence = { '??': 1, '||': 2, '&&': 3, '==': 4, '!=': 4, '===': 4, '!==': 4, '<': 5, '<=': 5, '>': 5, '>=': 5, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7 }
export function parseExpression(source, {dialect='legacy'} = {}) {
  if(dialect==='js-v1')return parseJavaScriptExpression(source)
  if(dialect!=='legacy')throw new Error(`unknown expression dialect ${dialect}`)
  if (source.length > 32768) throw new Error('expression too long')
  let i = 0, token, depth = 0
  function next() {
    while (/\s/.test(source[i] || '') && i < source.length) i++
    if (i >= source.length) return token = { kind: 'end', value: '' }
    const c = source[i]
    if (quoteEnd(c)) {
      const quote = quoteEnd(c); i++; let out = '', closed = false
      while (i < source.length) {
        const ch = source[i++]
        if (ch === quote) { closed = true; break }
        if (ch !== '\\') { out += ch; continue }
        const e = source[i++]
        if (e === 'u') {
          const h = source.slice(i, i + 4)
          if (!/^[a-f\d]{4}$/i.test(h)) throw new Error('invalid unicode escape')
          out += String.fromCharCode(parseInt(h, 16)); i += 4
        } else {
          const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\\': '\\', '/': '/', '"': '"', "'": "'" }
          if (!(e in escapes)) throw new Error('invalid string escape')
          out += escapes[e]
        }
      }
      if (!closed) throw new Error('unclosed string')
      return token = { kind: 'literal', value: out }
    }
    const num = /^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i.exec(source.slice(i))
    if (num) { i += num[0].length; return token = { kind: 'literal', value: Number(num[0]) } }
    const id = /^[A-Za-z_$][\w$]*/.exec(source.slice(i))
    if (id) {
      i += id[0].length
      const v = id[0]
      return token = ['true', 'false', 'null'].includes(v) ? { kind: 'literal', value: JSON.parse(v) } : { kind: 'id', value: v }
    }
    const op = /^(===|!==|==|!=|<=|>=|&&|\|\||\?\?|[+*/%<>=!?:.,()[\]{}-])/.exec(source.slice(i))
    if (!op) throw new Error(`unexpected expression character at ${i}`)
    i += op[0].length; return token = { kind: 'op', value: op[0] }
  }
  const take = (v) => { if (token.value !== v) throw new Error(`expected ${v}`); next() }
  function primary() {
    if (++depth > 32) throw new Error('expression nesting limit')
    let node
    if (token.kind === 'literal') { node = literal(token.value); next() }
    else if (token.value === '(') { next(); node = expr(0); take(')') }
    else if (['!', '-', '+'].includes(token.value)) { const op = token.value; next(); node = { type: 'unary', op, value: primary() } }
    else if (token.value === '[') {
      next(); const items = []
      while (token.value !== ']') { items.push(expr(0)); if (token.value !== ',') break; next(); }
      take(']'); node = { type: 'array', items }
    } else if (token.value === '{') {
      next(); const entries = []
      while (token.value !== '}') {
        if (!['id', 'literal'].includes(token.kind) || !safeKey(String(token.value))) throw new Error('invalid object key')
        const key = String(token.value); next(); take(':'); entries.push([key, expr(0)])
        if (token.value !== ',') break; next()
      }
      take('}'); node = { type: 'object', entries }
    } else if (token.kind === 'id') {
      const name = token.value
      if (!safeKey(name)) throw new Error('forbidden identifier')
      next(); node = { type: 'ref', name }
    } else throw new Error('expected expression')
    while (['.', '[', '('].includes(token.value)) {
      if (token.value === '.') {
        next(); if (token.kind !== 'id' || !safeKey(token.value)) throw new Error('invalid property')
        node = { type: 'get', object: node, key: literal(token.value) }; next()
      } else if (token.value === '[') {
        next(); const key = expr(0); take(']'); node = { type: 'get', object: node, key }
      } else {
        if (node.type !== 'ref' || !FUNCTION_NAMES.includes(node.name)) throw new Error('only registered functions may be called')
        next(); const args = []
        while (token.value !== ')') { args.push(expr(0)); if (token.value !== ',') break; next() }
        take(')')
        const limits = ({ min:[1,32], max:[1,32], clamp:[3,3], round:[1,2], formatNumber:[1,2], includes:[2,2], filter:[2,2], find:[2,2], map:[2,2], sum:[1,2], count:[1,2], formatDate:[1,3], dateKey:[1,2], addDays:[2,2], addMonths:[2,2] })[node.name] || [1,1]
        if (args.length < limits[0] || args.length > limits[1]) throw new Error(`${node.name} requires ${limits[0]}–${limits[1]} arguments; collections use item/index in the second expression`)
        node = { type: 'call', name: node.name, args }
      }
    }
    depth--; return node
  }
  function expr(min) {
    let left = primary()
    while ((precedence[token.value] ?? -1) >= min) {
      const op = token.value, p = precedence[op]; next()
      left = { type: 'binary', op, left, right: expr(p + 1) }
    }
    if (min === 0 && token.value === '?') {
      next(); const yes = expr(0); take(':'); left = { type: 'conditional', test: left, yes, no: expr(0) }
    }
    return left
  }
  next(); const ast = expr(0)
  if (token.kind !== 'end') throw new Error(`unexpected token ${token.value}`)
  return ast
}

export const FUNCTION_NAMES = ['min', 'max', 'clamp', 'round', 'formatNumber', 'floor', 'ceil', 'abs', 'len', 'number', 'string', 'includes', 'filter', 'find', 'map', 'sum', 'count', 'formatDate', 'dateKey', 'monthOf', 'dayOf', 'addDays', 'addMonths', 'range']
export function dateKey(value, zone = 'Asia/Shanghai') {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (!Number.isFinite(+d)) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
export function addDays(date, amount) {
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + Number(amount)); return Number.isFinite(+d) ? d.toISOString().slice(0, 10) : ''
}
export function addMonths(month, amount) {
  const d = new Date(`${String(month).slice(0, 7)}-01T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + Number(amount)); return Number.isFinite(+d) ? d.toISOString().slice(0, 7) : ''
}
export function monthCells(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return []
  const [y, m] = month.split('-').map(Number)
  const first = new Date(`${month}-01T12:00:00Z`)
  const leading = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: Math.ceil((leading + days) / 7) * 7 }, (_, i) => {
    const day = i - leading + 1
    return day < 1 || day > days ? null : `${month}-${String(day).padStart(2, '0')}`
  })
}
export function evaluate(ast, scope, budget = { remaining: 20000 }) {
  if(ast?.dialect==='js-v1')return evaluateJavaScriptExpression(ast,scope,budget,(name,values)=>evaluate({type:'call',name,args:values.map(literal)},scope,budget))
  if (--budget.remaining < 0) throw new Error('expression work limit exceeded')
  const ev = (a, s = scope) => evaluate(a, s, budget)
  if (!ast) return null
  switch (ast.type) {
    case 'literal': return ast.value
    case 'ref': if (!Object.hasOwn(scope, ast.name)) throw new Error(`unknown binding ${ast.name}`); return scope[ast.name]
    case 'get': {
      const obj = ev(ast.object), key = String(ev(ast.key))
      if (!safeKey(key)) throw new Error('forbidden property')
      if (obj != null && Object.hasOwn(Object(obj), key)) return obj[key]
      // Observe only evaluated reads, so optional fallbacks and untaken branches
      // retain their normal semantics. Action diagnostics can explain nulls.
      if (ast.object.type === 'ref' && ['event', 'args'].includes(ast.object.name)) budget.onMissingInput?.(ast.object.name, key)
      return null
    }
    case 'array': return ast.items.map((x) => ev(x))
    case 'object': return Object.fromEntries(ast.entries.map(([k, v]) => [k, ev(v)]))
    case 'unary': { const v = ev(ast.value); return ast.op === '!' ? !v : ast.op === '-' ? -Number(v) : Number(v) }
    case 'conditional': return ev(ast.test) ? ev(ast.yes) : ev(ast.no)
    case 'binary': {
      const a = ev(ast.left)
      if (ast.op === '&&') return a && ev(ast.right)
      if (ast.op === '||') return a || ev(ast.right)
      if (ast.op === '??') return a ?? ev(ast.right)
      const b = ev(ast.right)
      switch (ast.op) {
        case '+': return typeof a === 'string' || typeof b === 'string' ? String(a ?? '') + String(b ?? '') : Number(a) + Number(b)
        case '-': return Number(a) - Number(b)
        case '*': return Number(a) * Number(b)
        case '/': return Number(b) === 0 ? 0 : Number(a) / Number(b)
        case '%': return Number(a) % Number(b)
        case '==': case '===': return a === b
        case '!=': case '!==': return a !== b
        case '<': return a < b
        case '<=': return a <= b
        case '>': return a > b
        case '>=': return a >= b
      }
      throw new Error('unknown operator')
    }
    case 'call': {
      const a = ast.args, name = ast.name
      if (['filter', 'find', 'map', 'sum', 'count'].includes(name)) {
        const items = ev(a[0])
        if (!Array.isArray(items) || items.length > 1000) throw new Error('expected collection of at most 1000 items')
        const test = (item, index) => a[1] ? ev(a[1], { ...scope, item, index }) : item
        if (name === 'filter') return items.filter(test)
        if (name === 'find') return items.find(test) ?? null
        if (name === 'map') return items.map(test)
        if (name === 'count') return a[1] ? items.filter(test).length : items.length
        return items.reduce((sum, item, index) => sum + Number(test(item, index) || 0), 0)
      }
      const v = a.map((x) => ev(x))
      switch (name) {
        case 'min': return Math.min(...v)
        case 'max': return Math.max(...v)
        case 'clamp': return Math.max(v[1], Math.min(v[2], v[0]))
        case 'round': return Math.round(Number(v[0]) * 10 ** (v[1] || 0)) / 10 ** (v[1] || 0)
        case 'formatNumber': {
          const value = Number(v[0]), digits = v[1] ?? 2
          if (!Number.isFinite(value) || !Number.isInteger(digits) || digits < 0 || digits > 6) throw new Error('formatNumber expects a finite number and 0–6 fraction digits')
          return new Intl.NumberFormat('en-US', {useGrouping:false,minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value)
        }
        case 'floor': return Math.floor(v[0])
        case 'ceil': return Math.ceil(v[0])
        case 'abs': return Math.abs(v[0])
        case 'len': return v[0]?.length ?? (v[0] && typeof v[0] === 'object' ? Object.keys(v[0]).length : 0)
        case 'number': return Number.isFinite(Number(v[0])) ? Number(v[0]) : 0
        case 'string': return String(v[0] ?? '')
        case 'includes': return typeof v[0] === 'string' || Array.isArray(v[0]) ? v[0].includes(v[1]) : false
        case 'dateKey': return dateKey(v[0], v[1] || scope.context?.timeZone)
        case 'formatDate': {
          const key = dateKey(v[0], v[1] || scope.context?.timeZone)
          if (!key) return ''
          if (v[2] === 'yyyy-MM') return key.slice(0,7)
          if (v[2] === 'MM月dd日') return `${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日`
          return key
        }
        case 'monthOf': return String(v[0] || '').slice(0, 7)
        case 'dayOf': return Number(String(v[0] || '').slice(8, 10))
        case 'addDays': return addDays(v[0], v[1])
        case 'addMonths': return addMonths(v[0], v[1])
        case 'range': return Array.from({ length: Math.max(0, Math.min(1000, Math.floor(Number(v[0]) || 0))) }, (_, i) => i)
      }
      throw new Error(`unregistered function ${name}`)
    }
    default: throw new Error('unknown expression node')
  }
}
