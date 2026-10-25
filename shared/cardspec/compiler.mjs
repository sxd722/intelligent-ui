import {COMPOSITIONS} from './compositions.mjs'
import {contextualDiagnostics} from './diagnostic-context.mjs'
import {feedbackDiagnostics} from './feedback-diagnostics.mjs'
import {sampleFieldDiagnostics} from './sample-field-diagnostics.mjs'
import { parseExpression, evaluate, quoteEnd } from './expression.mjs'
import {javascriptExpressionEnd} from './javascript-expression.mjs'
import {readJsxAuthoring} from './jsx-authoring.mjs'
import { REGISTRY, THEMES, STATE_TYPES, checkValue, eventSamples, LITERAL_PRESENTATION_DEFAULTS } from './registry.mjs'
import { createStore, makeScope, executeAction } from './store.mjs'
import { validateWidget } from './widgets.mjs'
import { navigationDiagnostics } from './navigation.mjs'
import { getVisualStyle, validBackgroundQuery, BACKGROUND_POSITIONS } from './styles.mjs'
import { getDesign } from './designs.mjs'
import { TOOLS, validateJson, toolInitialValue } from './tools.mjs'
import {toolCollectionDiagnostics} from './tool-diagnostics.mjs'
import {bindingDependencies} from './dataflow.mjs'
import {interactionDiagnostics} from './interaction-diagnostics.mjs'
import {validateLogicSource,logicJson} from './logic-contract.mjs'
import {sandboxActions} from './sandbox-bridge.mjs'
import {COMPONENT_ALIASES,ignoredPresentationAttribute} from './presentation-compat.mjs'

const lit = (value) => ({ type: 'literal', value })
const declarations = new Set(['data', 'state', 'derive', 'action','binding'])
const inline = new Set(['text', 'title', 'caption', 'strong', 'emphasis', 'icon', 'badge', 'link', 'code', 'math'])
function unescapeText(text) {
  return text.replace(/&(#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);/gi, (_, key) => {
    if (key[0] === '#') {
      const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1))
      return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '\ufffd'
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[key] || ''
  })
}
export function compileCard(source,options={}) {
 const original=String(source),prefix=original.match(/^\s*```(?:xml|html|dil)?\s*\n/i)?.[0].length||0
 const result=compileDocument(original,options)
 result.source=original
 if(result.locations)result.locations=Object.fromEntries(Object.entries(result.locations).map(([id,at])=>[id,at+prefix]))
 result.diagnostics=contextualDiagnostics(original,result.diagnostics.map(d=>Number.isInteger(d.offset)?{...d,offset:d.offset+prefix}:d))
 return result
}
function compileDocument(source, { final = false, cardId = 'card', context = {}, revision = 1 } = {}) {
  source = String(source).replace(/^\s*```(?:xml|html|dil)?\s*\n/i, '').replace(/\n```\s*$/, '')
  const diagnostics = [], root = { name: '$root', children: [] }, stack = [root]
  const javascriptBoundaryCache={}
  let i = 0, pending = false, nodes = 0, incompleteExpressionStart = null, sawCard = false
  const error = (code, message, at = i) => diagnostics.push({ severity: 'error', code, message, offset: at, line: source.slice(0, at).split('\n').length })
  const fail = (message) => { throw new Error(message) }
  function balanced(literalSource=false) {
    // Embedded program text is a string, independent of the host expression
    // dialect. A static template preserves multiline JSX without escaping every
    // quote. Never evaluate template interpolation or parse JSX as CardSpec.
    if(literalSource&&/^\{\s*`/.test(source.slice(i))){
      const start=i,open=source.indexOf('`',i);let end=open+1,escape=false
      for(;end<source.length;end++){const c=source[end];if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c==='`')break}
      if(end===source.length){incompleteExpressionStart=start;pending=true;i=end;return null}
      let close=end+1;while(/\s/.test(source[close]||'')&&close<source.length)close++
      if(close===source.length){incompleteExpressionStart=start;pending=true;i=close;return null}
      if(source[close]!=='}'){error('expression','source requires a single static string',start);i=close;return lit(null)}
      i=close+1
      try{const value=parseExpression(source.slice(open,end+1),{dialect:'js-v1'});if(value.type!=='literal')throw Error('source template interpolation is not allowed; escape ${ inside program strings');return value}
      catch(e){error('expression',e.message,start);return lit(null)}
    }
    if(context.expressionDialect==='js-v1'){
      const start=i
      try{
        const end=javascriptExpressionEnd(source,start,unescapeText,javascriptBoundaryCache)
        if(end===null){incompleteExpressionStart=start;pending=true;i=source.length;return null}
        i=end+1
        try{return parseExpression(unescapeText(source.slice(start+1,end)),{dialect:'js-v1'})}
        catch(e){error('expression',e.message,start);return lit(null)}
      }catch{ /* Recover malformed/incomplete markup through the legacy scanner. */ }
    }
    const start = i++; let depth = 1, quote = '', escape = false
    const delimiters=['}'],closing={'{':'}','[':']','(':')'}
    for (; i < source.length; i++) {
      const c = source[i]
      if (quote) {
        if (escape) escape = false
        else if (c === '\\') escape = true
        else if (c === quote) quote = ''
      } else if (quoteEnd(c)) quote = quoteEnd(c)
      else if (source.startsWith('/>', i)) {
        // This cannot occur in a valid expression outside a string. Preserve
        // the tag boundary so a missing brace does not hide the entire card.
        error('expression', `missing ${delimiters.slice().reverse().join('')} before self-closing tag at line ${source.slice(0,i).split('\n').length}; close arrays/objects and then the attribute expression`, start)
        return lit(null)
      }
      else if (c === '{') {depth++;delimiters.push('}')}
      else if (c === '[' || c === '(') delimiters.push(closing[c])
      else if ((c === ']' || c === ')') && delimiters.at(-1)===c) delimiters.pop()
      else if (c === '}' && --depth === 0) {
        const text = source.slice(start + 1, i); i++
        // The balanced boundary is known even when the expression is invalid.
        // Keep scanning siblings to report independent errors in one repair.
        try { return parseExpression(unescapeText(text),{dialect:context.expressionDialect||'legacy'}) }
        catch (e) { error('expression', e.message, start); return lit(null) }
      }
      else if(c==='}'&&delimiters.at(-1)==='}')delimiters.pop()
    }
    incompleteExpressionStart = start; pending = true; return null
  }
  const space = () => { while (i < source.length && /\s/.test(source[i])) i++ }
  function name() {
    const m = /^[A-Za-z][\w-]*/.exec(source.slice(i))
    if (!m) fail('expected name')
    i += m[0].length; return m[0]
  }
  try {
    if (source.length > 262144) fail('source exceeds 256 KiB limit')
    while (i < source.length) {
      const parent = stack.at(-1), start = i
      // js-v1 prose is text, including code snippets such as {{i:0}}. Never
      // evaluate it. Keep legacy accepted literal-expression behavior intact.
      const plainProse=context.expressionDialect==='js-v1'&&stack.length===2&&['intro','outro'].includes(parent.name)
      if (source.startsWith('<!--', i)) {
        const end = source.indexOf('-->', i + 4)
        if (end < 0) { pending = true; break }
        i = end + 3; continue
      }
      if (source[i] === '<') {
        if (i + 1 === source.length) { pending = true; break }
        i++
        if (source[i] === '/') {
          i++; space()
          if (i >= source.length) { pending = true; break }
          const close = name(); space()
          if (i >= source.length) { pending = true; break }
          if (source[i++] !== '>') fail('expected closing >')
          if (stack.length < 2 || parent.name !== close) {
            error('syntax', `mismatched closing tag ${close}`, start)
            // Recover only for diagnostics. The error prevents publication.
            const match = stack.findLastIndex(node => node.name === close)
            if (match > 0) { stack[match].closed = true; stack.length = match }
            continue
          }
          parent.closed = true; stack.pop(); continue
        }
        if (!/[A-Za-z]/.test(source[i])) fail('literal < must be escaped as &lt;')
        const tag = name(), attrs = Object.create(null)
        if (tag === 'card') sawCard = true
        let self = false, finished = false
        while (i < source.length) {
          space()
          if (source.startsWith('/>', i)) { self = true; finished = true; i += 2; break }
          if (source[i] === '>') { finished = true; i++; break }
          if (i >= source.length || (source[i] === '/' && i + 1 === source.length)) break
          const key = name(); space()
          if (i >= source.length) break
          if (Object.hasOwn(attrs, key)) fail(`duplicate attribute ${key}`)
          if (source[i] !== '=' && REGISTRY[tag]?.props[key] === 'boolean') { attrs[key] = lit(true); continue }
          if (source[i++] !== '=') fail('attributes require = and a quoted value or expression')
          space(); if (i >= source.length) break
          let value
          if (source[i] === '{') { value = balanced(['sandbox','logic'].includes(tag)&&key==='source'); if (pending) break }
          else if (['"', "'", '“', '‘'].includes(source[i])) {
            // Accept typographic delimiters only at attribute boundaries. Do
            // not rewrite prose, apostrophes or strings inside expressions.
            const open = source[i++], quote = ({ '“': '”', '‘': '’' })[open] || open, from = i
            while (i < source.length && source[i] !== quote) i++
            if (i === source.length) break
            value = lit(unescapeText(source.slice(from, i++)))
          } else fail('unquoted attribute: use name="value" or name={expression}')
          // XML boolean spelling is unambiguous; preserve strict expression types.
          if (REGISTRY[tag]?.props[key] === 'boolean' && value?.type === 'literal' && ['true', 'false'].includes(value.value)) value = lit(value.value === 'true')
          if (['number', 'columns', 'lines'].includes(REGISTRY[tag]?.props[key]) && value?.type === 'literal' && typeof value.value === 'string' && /^-?\d+(\.\d+)?$/.test(value.value)) value = lit(Number(value.value))
          attrs[key] = value
        }
        if (!finished) { pending = true; break }
        if (++nodes > 512 || stack.length > 32) fail('document complexity limit')
        const node = { name: tag, attrs, children: [], closed: self, start }
        parent.children.push(node)
        if (!self) stack.push(node)
      } else if (source[i] === '{'&&!plainProse) {
        if(context.expressionDialect==='js-v1'){
          try{
            const jsx=readJsxAuthoring(source,i,{maxDepth:32-stack.length})
            if(jsx){nodes+=jsx.count;if(nodes>512)fail('document complexity limit');parent.children.push(...jsx.nodes);i=jsx.end+1;continue}
          }catch(e){
            if(e.expressionEnd!==undefined){error('jsx',e.message,e.offset??start);i=e.expressionEnd+1;continue}
            throw e
          }
        }
        const value = balanced(parent.name==='sandbox'); if (pending) break
        parent.children.push({ name: '#text', value, start })
      } else {
        while (i < source.length && source[i] !== '<' && (source[i] !== '{'||plainProse)) i++
        let text = source.slice(start, i)
        // Do not publish the tail of an incomplete character entity either.
        if (i === source.length && /&[^;\s]*$/.test(text)) { text = text.replace(/&[^;\s]*$/, ''); pending = true }
        text = unescapeText(text).replace(/\s+/g, ' ')
        if (text.trim()) parent.children.push({ name: '#text', value: lit(text), start })
      }
    }
  } catch (e) { error('syntax', e.message) }
  if (stack.length > 1) pending = true
  if (pending) {
    const offset = incompleteExpressionStart ?? i
    diagnostics.push({ severity: final ? 'error' : 'pending', code: 'incomplete', message: incompleteExpressionStart === null ? 'waiting for complete syntax' : 'unclosed expression: missing closing } for expression starting here', offset, line: source.slice(0, offset).split('\n').length })
  }
  const cards = root.children.filter((n) => n.name === 'card')
  if (cards.length > 1) error('structure', `exactly one card is allowed; found ${cards.length}. Output one complete corrected document, not the original followed by a correction. The last card is ${cards.at(-1).closed ? 'closed' : 'incomplete'}; do not discard an unfinished correction and silently accept the original`, cards[1].start)
  const card = cards[0]
  const spec = { schemaVersion: 1, cardId, revision, context, theme: 'editorial', palette: 'a', data: {}, state: {}, derived: {}, bindings:{}, actions: {}, children: [], intro: '', outro: '' }
  const constVal = (attrs, key, fallback) => attrs[key]?.type === 'literal' ? attrs[key].value : fallback
  const ids = new Set()
  let autoId = 0
  const expressions = []
  const staticString = (n, key, required = true) => {
    const value = constVal(n.attrs, key)
    if (required && typeof value !== 'string') error('attribute', `${n.name}.${key} must be a literal string`, n.start)
    return value
  }
  const baseRoots = new Set(['data', 'state', 'next', 'derived', 'bindings', 'context', 'event', 'args'])
  const nodeOffsets=new Map()
  const condition=ast=>context.expressionDialect==='js-v1'&&ast?{type:'call',name:'js:Boolean',args:[ast],dialect:'js-v1'}:ast
  const collectExpr = (ast, locals = new Set(), at = i) => { if (ast) expressions.push({ ast, locals, at }) }
  function walk(n, parentType = 'flow', locals = new Set()) {
    if (n.name === '#text') { collectExpr(n.value, locals, n.start); return { type: 'run', value: n.value, id: `run-${n.start}` } }
    if(Object.hasOwn(COMPONENT_ALIASES,n.name)){
      const original=n.name;n={...n,name:COMPONENT_ALIASES[n.name]}
      diagnostics.push({severity:'warning',code:'component_alias',message:`${original} normalized to ${n.name}`,offset:n.start,line:source.slice(0,n.start).split('\n').length})
    }
    const def = REGISTRY[n.name]
    if (!def) { error('component', `unknown component ${n.name}`, n.start); return null }
    // A literal action name has one unambiguous equivalent. Never swallow
    // callbacks, conflicting handlers or unsupported events on other nodes.
    if(n.attrs.onClick&&def.props.onPress&&n.attrs.onClick.type==='literal'&&typeof n.attrs.onClick.value==='string'){
      if(n.attrs.onPress)error('attribute','onClick and onPress conflict; provide one action handler',n.start)
      else{
        n={...n,attrs:{...n.attrs,onPress:n.attrs.onClick}};delete n.attrs.onClick
        diagnostics.push({severity:'warning',code:'event_alias',message:`${n.name}.onClick normalized to onPress; action and args preserved`,offset:n.start,line:source.slice(0,n.start).split('\n').length})
      }
    }
    const interactive=c=>['button','pressable','chip','link','input','textarea','select','checkbox','toggle','radio-group','segmented','slider','calendar','carousel','popover','table','collection','experience','map','mindmap','flowchart','chart','swipe-stack','navigation','copy','logic','sandbox','slot'].includes(c.name)||Object.keys(c.attrs||{}).some(k=>/^on[A-Z]/.test(k))||c.name==='region'&&constVal(c.attrs,'overflow')==='details'
    const nestedControl=children=>children.some(c=>interactive(c)||nestedControl(c.children||[]))
    if((['button','pressable','chip'].includes(n.name)||n.name==='list-item'&&n.attrs.onPress)&&nestedControl(n.children))error('content_model','clickable content cannot contain another interactive control; use sibling controls in a row or stack',n.start)
    // Omitted presentation IDs are a host concern. Allocation follows source
    // order, so append-only streaming and each templates retain their identity.
    // Explicit malformed/duplicate IDs and declaration IDs remain errors.
    let id = n.attrs.id ? staticString(n, 'id') : null
    if (!n.attrs.id) id = `@auto-${++autoId}` // reserved host namespace, never a valid explicit ID
    if ((n.attrs.id && !checkValue('id', id)) || ids.has(id)) error('identity', `invalid or duplicate node id ${id}; use a fixed literal template id, not item interpolation`, n.start)
    ids.add(id)
    nodeOffsets.set(id,n.start)
    if (parentType === 'inline' && !inline.has(n.name) && !['if', 'each'].includes(n.name)) error('content_model', `block ${n.name} inside inline content`, n.start)
    const props = {}
    const childLocals = new Set(locals)
    if(n.name==='sandbox'){
      const programs=n.children.filter(c=>c.name==='#text'&&c.value?.type==='literal'&&typeof c.value.value==='string'&&/^\s*export\s/.test(c.value.value))
      if(programs.length){
        if(n.attrs.source||programs.length!==1)error('sandbox','provide exactly one sandbox program, in source or a static string child',n.start)
        else{
          n={...n,attrs:{...n.attrs,source:programs[0].value},children:n.children.filter(c=>c!==programs[0])}
          diagnostics.push({severity:'warning',code:'sandbox_source_normalized',message:'sandbox static string child normalized to source; no model call',offset:n.start,line:source.slice(0,n.start).split('\n').length})
        }
      }
      if(context.renderMode!=='hybrid')error('capability','sandbox requires hybrid mode; implement the complete task with native CardSpec',n.start)
      if(n.attrs.brief?.type!=='literal')error('sandbox','sandbox.brief must be a fixed literal; changing input updates UI without regenerating code',n.start)
      if(!n.attrs.id||locals.has('index')||locals.has('local')||locals.has('sandbox')||locals.has('slot'))error('sandbox','sandbox requires explicit id and cannot be nested or placed inside each/logic/slot',n.start)
      if(n.attrs.source&&n.attrs.source.type!=='literal')error('sandbox','sandbox.source must be a fixed JSX string literal',n.start)
      if(n.attrs.actions&&(n.attrs.actions.type!=='object'||n.attrs.actions.entries.some(([,v])=>v.type!=='literal'||typeof v.value!=='string')))error('sandbox','sandbox.actions must be a fixed alias-to-action object',n.start)
      childLocals.add('sandbox')
    }
    if(n.name==='slot')childLocals.add('slot')
    if(n.name==='logic'){
      if(locals.has('index'))error('logic','place logic outside each; repeat UI inside logic instead',n.start)
      if(locals.has('local'))error('logic','nested logic is not supported',n.start)
      childLocals.add('local')
      if(!n.attrs.id)error('logic','logic requires a stable explicit id',n.start)
      if(n.attrs.source)try{validateLogicSource(constVal(n.attrs,'source'))}catch(e){error('logic',e.message,n.start)}
    }
    if(n.name==='slot'&&locals.has('local'))error('logic','slot is not allowed inside logic',n.start)
    if(locals.has('local')&&(n.name==='link'||n.name==='image'&&n.attrs.query))error('logic','external links and image queries belong outside logic; use host-issued assetRef for images',n.start)
    if (n.name === 'each') {
      const alias = constVal(n.attrs, 'as', 'item')
      if (n.attrs.as && (n.attrs.as.type !== 'literal' || typeof alias !== 'string' || !/^[A-Za-z_][\w]*$/.test(alias) || baseRoots.has(alias) || ['index','local'].includes(alias))) {
        error('binding', 'each.as must be a literal identifier; it cannot shadow data/state/next/derived/bindings/context/event/args/index', n.start)
      }
      childLocals.add('item'); childLocals.add('index'); childLocals.add(alias)
    }
    for (const [key, rawValue] of Object.entries(n.attrs)) {
      const value=n.name==='if'&&key==='test'?condition(rawValue):rawValue
      if (key === 'id') continue
      if(ignoredPresentationAttribute(key,value)){
        diagnostics.push({severity:'warning',code:'presentation_ignored',message:`${n.name}.${key} ignored; host design tokens control styling. Content and actions are preserved.`,offset:n.start,line:source.slice(0,n.start).split('\n').length});continue
      }
      if (!(key in def.props)) error('attribute', `${n.name}.${key} is not supported`, n.start)
      else if (value.type === 'literal' && !checkValue(def.props[key], value.value)) {
        const fallback=LITERAL_PRESENTATION_DEFAULTS[n.name]?.[key]
        if(typeof value.value==='string'&&fallback!==undefined){
          props[key]=lit(fallback)
          diagnostics.push({severity:'warning',code:'presentation_default',message:`${n.name}.${key}=${JSON.stringify(value.value)} is not recognized; using ${JSON.stringify(fallback)}. Content, overflow and actions are preserved.`,offset:n.start,line:source.slice(0,n.start).split('\n').length})
        }else error('type', `${n.name}.${key}: expected ${def.props[key]}`, n.start)
      }
      else { props[key] = value; collectExpr(value, n.name === 'each' && key === 'itemKey' ? childLocals : locals, n.start) }
      if (!(['logic','sandbox'].includes(n.name)&&key==='source') && def.props[key] === 'string' && value.type === 'literal' && typeof value.value === 'string' && /\{\s*(?:state|data|derived|context|item|event|args)[.[]/.test(value.value)) {
        error('interpolation', `${n.name}.${key}: quoted attributes are literal; use {"text " + state.value} for dynamic text`, n.start)
      }
    }
    for (const key of def.required || []) if (!props[key]) error('contract', `${n.name} requires ${key}`, n.start)
    if(n.name==='image'&&!!props.query===!!props.assetRef)error('contract','image requires exactly one of query or assetRef',n.start)
    if (n.name === 'each' && (!props.items || !props.itemKey)) error('identity', 'each requires items and itemKey', n.start)
    if (def.children === 'none' && n.children.length) error('content_model', `${n.name} does not accept children`, n.start)
    return { type: n.name, id, props, children: n.children.map((c) => walk(c, def.children === 'inline' || parentType === 'inline' ? 'inline' : 'flow', childLocals)).filter(Boolean) }
  }
  for (const n of root.children) {
    if (n.name === 'intro' || n.name === 'outro') {
      if (n.children.some((c) => c.name !== '#text' || c.value.type !== 'literal')) error('prose', 'intro/outro must contain plain text', n.start)
      spec[n.name] = n.children.filter((c) => c.value?.type === 'literal').map((c) => c.value.value).join('')
    } else if(n.name==='#text'&&n.value.type==='literal'&&source[n.start]!=='{'&&final&&!pending&&cards.length===1&&card.closed&&root.children.every(c=>['#text','intro','card','outro'].includes(c.name))){
      diagnostics.push({severity:'warning',code:'envelope_prose_ignored',message:'Plain commentary outside the single complete card ignored; original source retained in trace',offset:n.start,line:source.slice(0,n.start).split('\n').length})
    } else if (n.name !== 'card') error('structure', 'output only intro, card and outro', n.start)
  }
  if (!card) { if (final && !sawCard) error('structure', 'missing card'); return { spec: null, diagnostics, complete: false } }
  for (const key of Object.keys(card.attrs)) if (!['schemaVersion', 'theme', 'palette', 'design', 'composition', 'visualStyle', 'backgroundQuery', 'backgroundPosition', 'backgroundMask', 'actionMode'].includes(key)) error('attribute', `unsupported card.${key}`, card.start)
  if (Object.hasOwn(card.attrs, 'design')) {
    const design = constVal(card.attrs, 'design')
    if (card.attrs.design.type !== 'literal' || !getDesign(design)) error('design', 'card.design must be a literal supported design recipe', card.start)
    else spec.design = design
  }
  if(card.attrs.backgroundMask){
    const value=constVal(card.attrs,'backgroundMask')
    if(card.attrs.backgroundMask.type!=='literal'||!['spotlight','fade-left','mist'].includes(value))error('background_mask','unsupported photo mask',card.start)
    else spec.backgroundMask=value
  }
  if(['default','pearl','atlas','rebel','parchment','business','academy'].includes(context.designPreference)){
    if(spec.design!==context.designPreference)diagnostics.push({severity:'warning',code:'host_design_applied',message:'Host applied the requested design '+context.designPreference,offset:card.start,line:1})
    spec.design=context.designPreference
  }
  if(card.attrs.composition){
    const value=constVal(card.attrs,'composition')
    if(card.attrs.composition.type!=='literal'||value!=='auto'&&!Object.hasOwn(COMPOSITIONS,value))error('composition','unsupported composition',card.start)
    else spec.composition=value
  }
  if (card.attrs.actionMode) {
    spec.actionMode = constVal(card.attrs, 'actionMode')
    if (!['snapshot','sequential'].includes(spec.actionMode)) error('action_mode', 'card.actionMode must be literal snapshot or sequential', card.start)
  }
  if (String(constVal(card.attrs, 'schemaVersion', '1')) !== '1') error('version', 'unsupported schema version')
  spec.theme = constVal(card.attrs, 'theme', 'editorial'); spec.palette = constVal(card.attrs, 'palette', 'a')
  if (!THEMES.includes(spec.theme) || !['a', 'b', 'c'].includes(spec.palette)) error('theme', 'invalid theme/palette')
  // Existing cards are unchanged. Once opted in, a complete literal contract is
  // required so streaming and later interactions cannot replace the backdrop.
  if (['visualStyle', 'backgroundQuery', 'backgroundPosition'].some(key => Object.hasOwn(card.attrs, key))) {
    const style = constVal(card.attrs, 'visualStyle'), query = constVal(card.attrs, 'backgroundQuery')
    const position = constVal(card.attrs, 'backgroundPosition', 'center')
    if (!getVisualStyle(style)) error('visual_style', 'card.visualStyle must be a literal supported style token', card.start)
    if (!validBackgroundQuery(query)) error('background_query', 'card.backgroundQuery must be a literal search phrase of 1–100 characters, not a URL', card.start)
    if ((card.attrs.backgroundPosition && card.attrs.backgroundPosition.type !== 'literal') || !BACKGROUND_POSITIONS.includes(position)) error('background_position', 'card.backgroundPosition must be a literal center, top, bottom, left or right', card.start)
    if (getVisualStyle(style)) spec.visualStyle = style
    if (validBackgroundQuery(query)) spec.backgroundQuery = query.trim()
    spec.backgroundPosition = position
  }
  const declared = { data: new Set(), state: new Set(), derive: new Set(), action: new Set(),binding:new Set() }
  for (const n of card.children) {
    if (!declarations.has(n.name)) { const node = walk(n); if (node) spec.children.push(node); continue }
    if (!n.closed) continue
    const id = staticString(n, 'id')
    if (!checkValue('id', id) || declared[n.name].has(id)) { error('declaration', `invalid/duplicate ${n.name} ${id}`, n.start); continue }
    declared[n.name].add(id)
    const allowed = n.name==='binding'?['id','tool','input','initial','load','refresh','requires']:n.name === 'state' ? ['id', 'type', 'initial'] : n.name === 'action' ? ['id'] : ['id', 'type', 'value']
    for (const key of Object.keys(n.attrs)) if (!allowed.includes(key)) error('attribute', `unsupported ${n.name}.${key}`, n.start)
    if(n.name==='binding') {
      const tool=staticString(n,'tool'),load=constVal(n.attrs,'load','manual'),rawRefresh=constVal(n.attrs,'refresh',0),refresh=rawRefresh===true?60:Number(rawRefresh)
      for(const field of ['load','refresh'])if(n.attrs[field]&&n.attrs[field].type!=='literal')error('tool',`${field} must be literal`,n.start)
      if(!TOOLS[tool])error('tool',`unknown tool ${tool}`,n.start)
      // Parameter names are knowable before execution even when values depend on
      // user input. Check names without rejecting an intentionally empty draft.
      if(n.attrs.input?.type==='object'&&TOOLS[tool])for(const [key] of n.attrs.input.entries)
        if(!Object.hasOwn(TOOLS[tool].inputSchema.properties||{},key))error('tool',`${tool}.input: unknown parameter ${key}`,n.start)
      if(!['manual','visible'].includes(load)||!Number.isInteger(refresh)||(refresh!==0&&(refresh<30||refresh>86400)))error('tool','invalid load/refresh policy: use 0 or 30–86400 seconds',n.start)
      if(['glm.generate','dataset.analyze'].includes(tool)&&(load!=='manual'||refresh))error('tool',`${tool} requires a user action; use load="manual" without refresh and invoke it from an action`,n.start)
      if(TOOLS[tool]?.readOnly===false&&(load!=='manual'||refresh))error('tool','write tools require manual load without refresh',n.start)
      const hostInitial=context.expressionDialect==='js-v1'&&!n.attrs.initial?toolInitialValue(tool):undefined
      if(tool!=='glm.generate'&&!n.attrs.initial&&hostInitial===undefined)error('tool','CLI binding requires initial value',n.start)
      if(n.attrs.requires&&(n.attrs.requires.type!=='literal'||typeof n.attrs.requires.value!=='string'))error('tool','binding.requires must be a literal list of binding IDs',n.start)
      const requires=String(staticString(n,'requires',false)||'').split(/[\s,]+/).filter(Boolean)
      spec.bindings[id]={tool,input:n.attrs.input||lit({}),initial:n.attrs.initial||lit(hostInitial??null),load,refresh,requires}
      collectExpr(n.attrs.input);collectExpr(n.attrs.initial)
      if(n.children.length)error('tool','binding cannot have children',n.start)
    } else if (n.name === 'data' || n.name === 'derive') {
      if (!n.attrs.value) error('declaration', `${n.name} needs value`, n.start)
      else { spec[n.name === 'data' ? 'data' : 'derived'][id] = n.attrs.value; collectExpr(n.attrs.value) }
    } else if (n.name === 'state') {
      const type = staticString(n, 'type')
      if (!STATE_TYPES.includes(type) || !n.attrs.initial) error('declaration', 'state needs type and initial', n.start)
      else { spec.state[id] = { type, initial: n.attrs.initial }; collectExpr(n.attrs.initial) }
    } else {
      if (!n.children.length || n.children.length > 16) error('action', 'action requires 1–16 steps', n.start)
      spec.actions[id] = n.children.map((s) => {
        if(s.attrs?.when)s.attrs.when=condition(s.attrs.when)
        if(s.name==='invoke') {
          for(const key of Object.keys(s.attrs||{}))if(!['binding','target','input','when','onSuccess','onError'].includes(key))error('attribute',`unknown invoke attribute ${key}`,s.start)
          for(const key of ['binding','target','onSuccess','onError'])if(s.attrs[key]&&(s.attrs[key].type!=='literal'||typeof s.attrs[key].value!=='string'))error('tool',`invoke.${key} must be a literal string`,s.start)
          if(s.children?.length)error('action','invoke must be empty',s.start)
          collectExpr(s.attrs.when)
          collectExpr(s.attrs.input)
          return {type:'invoke',binding:staticString(s,'binding'),target:constVal(s.attrs,'target','binding'),input:s.attrs.input,onSuccess:staticString(s,'onSuccess',false),onError:staticString(s,'onError',false),when:s.attrs.when}
        }
        if (!['set', 'toggle', 'increment', 'append', 'update', 'remove'].includes(s.name)) error('action', `unknown step ${s.name}`, s.start)
        if (s.children?.length) error('action', 'action steps must be empty elements', s.start)
        for (const key of Object.keys(s.attrs || {})) if (!['target', 'key', 'value', 'when'].includes(key)) error('attribute', `unknown action attribute ${key}`, s.start)
        collectExpr(s.attrs?.value); collectExpr(s.attrs?.key); collectExpr(s.attrs?.when)
        return { type: s.name, target: staticString({ ...s, attrs: s.attrs || {} }, 'target'), value: s.attrs?.value, key: s.attrs?.key, ...(s.attrs?.when ? { when:s.attrs.when } : {}) }
      })
    }
  }
  if (final && !spec.children.length) error('structure', 'card requires visible UI nodes; data, state, derive and action declarations alone do not form a card', card.start)
  function validateExpr(ast, locals, at) {
    if (!ast || typeof ast !== 'object') return
    if(context.expressionDialect==='js-v1'&&ast.type==='ref'&&!baseRoots.has(ast.name)&&!locals.has(ast.name)){
      const declarations=['data','state','derived'].filter(root=>Object.hasOwn(spec[root],ast.name))
      if(declarations.length===1){
        const name=ast.name,root=declarations[0];delete ast.name
        Object.assign(ast,{type:'get',object:{type:'ref',name:root,dialect:'js-v1'},key:{type:'literal',value:name,dialect:'js-v1'}})
      }
    }
    if (ast.type === 'ref' && !baseRoots.has(ast.name) && !locals.has(ast.name)) error('binding', `unknown binding ${ast.name} in this scope; each aliases exist only in their itemKey and children. Collection predicates use item/index; use a distinct outer alias for nested comparisons. Pass row values to actions through args`, at)
    // Predicates introduce item/index only for their second argument. Validate
    // even empty collections and inactive branches; no tool data is required.
    if (ast.type === 'call' && ['filter', 'find', 'map', 'sum', 'count','some','every','findIndex','reduce'].includes(ast.name)) {
      ast.args.forEach((arg, index) => validateExpr(arg, index === 1 ? new Set([...locals, ...(ast.params||['item','index'])]) : locals, at))
      return
    }
    if (ast.type === 'get' && ast.object?.type === 'get' && ast.object.object?.type === 'ref' && ast.object.object.name === 'bindings' && ast.object.key?.type === 'literal' && ast.key?.type === 'literal') {
      const id=String(ast.object.key.value),field=String(ast.key.value)
      if(Object.hasOwn(spec.bindings,id)&&!['value','status','error','updatedAt'].includes(field))
        error('binding_result_path',`bindings.${id}.${field} is not a binding envelope field. Read tool data at bindings.${id}.value.${field}; envelope fields are value/status/error/updatedAt. Apply this path consistently in derives, UI and actions.`,at)
    }
    if (ast.type === 'get' && ast.object?.type === 'ref' && ['data', 'state', 'next', 'derived','bindings'].includes(ast.object.name) && ast.key?.type === 'literal') {
      if (!Object.hasOwn(spec[ast.object.name === 'next' ? 'state' : ast.object.name], String(ast.key.value))) {
        const alternatives=['data','state','derived','bindings'].filter(root=>Object.hasOwn(spec[root],String(ast.key.value)))
        const readable=['data','state','derived']
        if(context.expressionDialect==='js-v1'&&readable.includes(ast.object.name)&&alternatives.length===1&&readable.includes(alternatives[0])){
          const before=ast.object.name;ast.object.name=alternatives[0]
          diagnostics.push({severity:'warning',code:'binding_namespace_normalized',message:`${before}.${ast.key.value} resolved to its unique declaration ${ast.object.name}.${ast.key.value}; writes and next semantics are unchanged`,offset:at,line:source.slice(0,at).split('\n').length})
          return
        }
        const hint=alternatives.length===1?`; ${ast.key.value} is declared in ${alternatives[0]}, use ${alternatives[0]}.${ast.key.value} in ALL expressions, including other derives, UI and actions`:''
        error('binding', `unknown ${ast.object.name}.${ast.key.value}${hint}`)
      }
    }
    for (const value of Object.values(ast)) {
      if (Array.isArray(value)) value.flat().forEach(child => validateExpr(child, locals, at))
      else if (value && typeof value === 'object') validateExpr(value, locals, at)
    }
  }
  expressions.forEach(({ ast, locals, at }) => validateExpr(ast, locals, at))
  const slots=new Set()
  function findSlots(nodes,inSlot=false){for(const n of nodes){if(n.type==='slot'){if(inSlot)error('tool','nested slots are not supported');slots.add(n.id)}findSlots(n.children||[],inSlot||n.type==='slot')}}
  findSlots(spec.children)
  if(Object.keys(spec.bindings).length>16)error('tool','at most sixteen declared bindings per card')
  if(Object.values(spec.bindings).filter(b=>b.load==='visible').length>4)error('tool','at most four automatically loaded bindings; use load="manual" for on-demand tools')
  for (const steps of Object.values(spec.actions)) for (const step of steps) {
    if(step.type==='invoke') {
      const binding=spec.bindings[step.binding]
      if(!binding)error('tool',`unknown binding ${step.binding}`)
      if(typeof step.target!=='string'||!['binding','page',...[...slots].map(id=>`slot:${id}`)].includes(step.target))error('tool',`unknown invocation target ${step.target}`)
      if(step.target!=='binding'&&binding?.tool!=='glm.generate')error('tool','only glm.generate creates page/slot UI; bind CLI JSON to existing components')
      for(const cb of [step.onSuccess,step.onError])if(cb&&!Object.hasOwn(spec.actions,cb))error('action',`unknown callback ${cb}`)
    } else if (!Object.hasOwn(spec.state, step.target)) error('action', `unknown state target ${step.target}`)
  }
  let logicCount=0,sandboxCount=0
  function validateEvents(node,inLogic=false) {
    if(node.type==='sandbox'&&++sandboxCount>1)error('sandbox','at most one sandbox per card')
    if(node.type==='logic'){
      inLogic=true;if(++logicCount>4)error('logic','at most four logic modules per card')
      if(node.props.actions)try{
        const ast=node.props.actions
        if(ast.type!=='object'||ast.entries.some(([k,v])=>['init','input','tick'].includes(k)||!checkValue('id',k)||v.type!=='literal'||!Object.hasOwn(spec.actions,v.value)))throw Error('logic.actions must map literal user event names to existing action IDs; init/input/tick are reserved')
      }catch(e){error('logic',e.message)}
    }
    for (const [key, value] of Object.entries(node.props || {})) if (key.startsWith('on')) {
      if (value.type !== 'literal' || (inLogic?!checkValue('id',value.value):!Object.hasOwn(spec.actions, value.value))) error('action', `unknown action ${value.value}`)
    }
    node.children?.forEach(n=>validateEvents(n,inLogic))
  }
  spec.children.forEach(n=>validateEvents(n))
  if(final)diagnostics.push(...toolCollectionDiagnostics(spec),...interactionDiagnostics(spec),...feedbackDiagnostics(spec))
  for(const id of Object.keys(spec.bindings)){
    function dependencies(name,trail=[]){
      if(trail.includes(name)){error('tool_dependency',`cyclic tool dependency: ${[...trail,name].join(' -> ')}`);return}
      for(const dep of bindingDependencies(spec,name)){
        if(!spec.bindings[dep])error('tool_dependency',`${name}: unknown required binding ${dep}`)
        else dependencies(dep,[...trail,name])
      }
    }
    dependencies(id)
  }
  diagnostics.push(...navigationDiagnostics(spec, { final }))
  // Placeholder ASTs from invalid expressions exist only to continue diagnosis.
  // Do not manufacture runtime errors by evaluating those placeholders.
  if (!diagnostics.some(d => ['expression', 'syntax','binding_result_path'].includes(d.code))) try {
    const scope = makeScope(spec, createStore())
    if(final)diagnostics.push(...sampleFieldDiagnostics(spec,scope))
    for(const [id,b] of Object.entries(spec.bindings))if(TOOLS[b.tool]?.outputSchema)validateJson(scope.bindings[id].value,TOOLS[b.tool].outputSchema)
    for (const ast of Object.values(spec.data)) evaluate(ast, scope)
    for (const ast of Object.values(spec.derived)) evaluate(ast, scope)
    // Check initial rendered values as well as declaration syntax. Event arguments
    // are intentionally deferred; inactive branches may depend on absent data.
    let visited = 0,previewErrors=0
    const preview = (nodes, local) => {
      for (const node of nodes) {
        if(previewErrors>=16)return
        if (++visited > 5000){error('binding','initial view exceeds node budget',nodeOffsets.get(node.id));previewErrors=16;return}
        try{
        if (node.type === 'run') { evaluate(node.value, local); continue }
        const props = {}
        for (const [key, ast] of Object.entries(node.props)) {
          if (key === 'args' || key === 'itemKey') continue
          props[key] = evaluate(ast, local)
          if (!checkValue(REGISTRY[node.type].props[key], props[key])) throw new Error(`${node.id}: ${node.type}.${key} expected ${REGISTRY[node.type].props[key]}`)
        }
        if (props.visible === false || (node.type === 'if' && !props.test)) continue
        validateWidget(node.type, props)
        if(node.type==='sandbox'){
          sandboxActions(props.actions||{},spec)
          logicJson(props.initial||{},{record:true});logicJson(props.input||{})
          if(!props.brief.trim()||props.brief.length>1200)throw Error('sandbox.brief requires 1–1200 characters')
          if(props.height!==undefined&&(!Number.isInteger(props.height)||props.height<160||props.height>480))throw Error('sandbox.height must be 160–480')
        }
        if(node.type==='logic'){
          logicJson(props.initial,{record:true});logicJson(props.input||{})
          if(props.tickMs!==undefined&&(!Number.isInteger(props.tickMs)||props.tickMs<250||props.tickMs>2000))throw Error('logic.tickMs must be an integer from 250 to 2000')
          // Reactive JS computes its derived view in isolated init. Requiring
          // every computed field in initial forces duplicated placeholder data.
          // Structural validation still visits all descendants above; completed
          // generation validates their values after init in validateRichContent.
          if(props.reactive!==true)preview(node.children,{...local,local:props.initial})
          continue
        }
        // Disabled controls cannot dispatch events in the initial UI. Validating
        // an empty form as though Submit were clicked rejects ordinary forms.
        // The action still validates its input transactionally when enabled.
        const events = props.disabled === true ? {} : eventSamples(node.type, props, context)
        for (const [name, event] of Object.entries(events)) {
          if (Object.hasOwn(local,'local') || !props[name] || !spec.actions[props[name]]) continue
          const args = node.props.args ? evaluate(node.props.args, { ...local, event }) : {}
          const probe = createStore(); makeScope(spec, probe)
          try { executeAction(spec, probe, props[name], { ...local, event, args }) }
          catch (e) { throw new Error(`${node.id}.${name}: ${e.message}`) }
        }
        if (node.type === 'each') {
          const seen = new Set()
          for (const [index, item] of (props.items || []).entries()) {
            const child = { ...local, item, index, [props.as || 'item']: item }
            const key = evaluate(node.props.itemKey, child)
            if (key == null || key === '' || seen.has(String(key))) throw new Error(`${node.id}: itemKey must be unique and nonempty`)
            seen.add(String(key)); preview(node.children, child)
          }
        } else preview(node.children, local)
        }catch(e){previewErrors++;error('binding',e.message,nodeOffsets.get(node.id))}
      }
    }
    preview(spec.children, scope)
  } catch (e) { error('binding', e.message) }
  if (final && /(?:已坚持|连续打卡|已观察)\s*\d+\s*天/.test(source)) error('unbound_history', 'historical statistics require supplied history; do not invent streaks')
  return { spec, diagnostics, locations:Object.fromEntries(nodeOffsets), complete: !!card.closed && !pending && !diagnostics.some((d) => d.severity === 'error') }
}
