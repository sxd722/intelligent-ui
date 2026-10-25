// Tolerant streaming parser for the DIL source emitted by the model.
//
// Mirrors the reference server-side behaviour: every partial buffer is re-parsed,
// incomplete syntax is recovered (rendered-prefix strategy), and problems are reported
// through `diagnostics` entries shaped like the observed recoveryDiagnostics:
//   { code: 'unterminated_tag' | 'unclosed_block' | 'unterminated_braced_value' | 'unterminated_attribute',
//     action: 'recovered_parse', line, column }
//
// AST node shapes:
//   { t:'text',  segs: [{k:'s',v} | {k:'e',v} | {k:'b',v}] }   static / expression / bold run
//   { t:'tag',   name, attrs:[{name, form:'str'|'expr'|'bare', value}], children, startIndex, endIndex }
//   { t:'each',  expr, item, index, children }
//   { t:'if',    cond, then, els }

const DIRECTIVE_PREFIX = '{@body'

export function lineCol(src, index) {
  let line = 1
  let lastNl = -1
  const stop = Math.min(index, src.length - 1)
  for (let i = 0; i <= stop; i++) {
    if (src[i] === '\n') {
      line++
      lastNl = i
    }
  }
  return { line, column: index - lastNl }
}

function isLineStart(src, index) {
  let j = index - 1
  while (j >= 0) {
    const c = src[j]
    if (c === '\n') return true
    if (c !== ' ' && c !== '\t' && c !== '\r') return false
    j--
  }
  return true
}

export function stripCodeFences(src) {
  // Defensive: some models wrap everything in ``` fences despite instructions.
  return src
    .split(/\r?\n/)
    .filter((line) => !/^\s*```\w*\s*$/.test(line))
    .join('\n')
}

export function parse(src) {
  const diagnostics = []
  const directives = [] // { code, index }
  const asyncTags = []  // AsyncImage tag nodes (filled during parse)

  const root = { kind: 'root', children: [] }
  const stack = [root]
  let buf = ''
  let i = 0
  const n = src.length
  let markupStart = n, markupEnd = 0
  const mark = (start, end) => {
    markupStart = Math.min(markupStart, start)
    markupEnd = Math.max(markupEnd, end)
  }

  const top = () => stack[stack.length - 1]

  function targetOf(frame) {
    return frame.kind === 'if' ? (frame.inElse ? frame.els : frame.then) : frame.children
  }

  function flush() {
    if (buf) {
      // model-emitted hard newlines inside text runs render as breaks — collapse
      // whitespace runs HTML-style so text stays on one line
      buf = buf.replace(/\s+/g, ' ')
      const target = targetOf(top())
      const last = target[target.length - 1]
      if (last && last.t === 'text' && last.segs.length && last.segs[last.segs.length - 1].k === 's') {
        last.segs[last.segs.length - 1].v += buf
      } else {
        target.push({ t: 'text', segs: [{ k: 's', v: buf }] })
      }
      buf = ''
    }
  }

  function pushSeg(seg) {
    flush()
    const target = targetOf(top())
    const last = target[target.length - 1]
    if (last && last.t === 'text') last.segs.push(seg)
    else target.push({ t: 'text', segs: [seg] })
  }

  function diag(code, index, extra = {}) {
    const { line, column } = lineCol(src, index)
    diagnostics.push({ code, action: 'recovered_parse', line, column, ...extra })
  }

  // src[start] must be '{'; returns index just past the matching '}', or -1.
  function scanBalancedBrace(start) {
    let depth = 0
    let quote = '', escape = false, comment = ''
    for (let j = start; j < n; j++) {
      const c = src[j]
      if (comment === 'line') { if (c === '\n') comment = ''; continue }
      if (comment === 'block') { if (c === '*' && src[j + 1] === '/') { comment = ''; j++ }; continue }
      if (quote) {
        if (escape) escape = false
        else if (c === '\\') escape = true
        else if (c === quote) quote = ''
        continue
      }
      if (c === '/' && src[j + 1] === '/') { comment = 'line'; j++; continue }
      if (c === '/' && src[j + 1] === '*') { comment = 'block'; j++; continue }
      if (['"', "'", '`'].includes(c)) { quote = c; continue }
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) return j + 1
      }
    }
    return -1
  }

  // Returns {name, attrs, selfClose, consumed} | {pending:true} | null (not a tag).
  // {pending:true} = tag is unterminated at EOF -> caller should drop the tail.
  function tryParseOpenTag(start) {
    let j = start + 1
    const nameM = /^[A-Za-z][\w-]*/.exec(src.slice(j, j + 48))
    if (!nameM) return null
    const name = nameM[0]
    j += name.length
    const attrs = []
    let selfClose = false
    let guard = 0
    while (j < n && guard++ < 400) {
      while (j < n && /\s/.test(src[j])) j++
      if (j >= n) return { pending: true }
      if (src[j] === '>') {
        j++
        return { name, attrs, selfClose, consumed: j - start }
      }
      if (src[j] === '/' && src[j + 1] === '>') {
        j += 2
        return { name, attrs, selfClose: true, consumed: j - start }
      }
      const attrM = /^[A-Za-z_][\w-]*/.exec(src.slice(j, j + 64))
      if (!attrM) {
        j++
        continue
      }
      const attrName = attrM[0]
      j += attrName.length
      while (j < n && /\s/.test(src[j])) j++
      if (src[j] !== '=') {
        attrs.push({ name: attrName, form: 'bare', value: true })
        continue
      }
      j++
      while (j < n && /\s/.test(src[j])) j++
      const q = src[j]
      if (q === '"' || q === "'") {
        const end = src.indexOf(q, j + 1)
        if (end === -1) {
          diag('unterminated_attribute', start)
          return { pending: true }
        }
        const raw = src.slice(j + 1, end)
        // tolerant DIL: quoted strings may embed {expr} runs — value="x {i+1}"
        // (models do this constantly). Split into static/expression segs.
        const parts = raw.split(/(\{[^{}]*\})/).filter((p) => p !== '')
        if (parts.length > 1 || /^\{[^{}]*\}$/.test(raw)) {
          attrs.push({
            name: attrName,
            form: 'segs',
            value: parts.map((p) =>
              p.startsWith('{') && p.endsWith('}')
                ? { t: 'e', v: p.slice(1, -1).trim() }
                : { t: 's', v: p }
            )
          })
        } else {
          attrs.push({ name: attrName, form: 'str', value: raw })
        }
        j = end + 1
      } else if (q === '{') {
        const close = scanBalancedBrace(j)
        if (close === -1) {
          diag('unterminated_attribute', start)
          return { pending: true }
        }
        attrs.push({ name: attrName, form: 'expr', value: src.slice(j + 1, close - 1).trim() })
        j = close
      } else {
        const bareM = /^[^\s>]+/.exec(src.slice(j))
        if (!bareM) return { pending: true }
        attrs.push({ name: attrName, form: 'bare', value: bareM[0] })
        j += bareM[0].length
      }
    }
    return { pending: true }
  }

  function recordAsyncTag(node) {
    if (!asyncTags.includes(node)) asyncTags.push(node)
  }

  while (i < n) {
    const ch = src[i]

    // Directives are balanced JavaScript blocks, including multiline data.
    // An incomplete directive owns its entire tail: never render it as text.
    if (src.startsWith(DIRECTIVE_PREFIX, i) && /[\s}]/.test(src[i + DIRECTIVE_PREFIX.length] || '}') && isLineStart(src, i)) {
      flush()
      const close = scanBalancedBrace(i)
      mark(i, close === -1 ? n : close)
      if (close !== -1) {
        directives.push({
          code: src.slice(i + DIRECTIVE_PREFIX.length, close - 1).trim(),
          index: i
        })
      } else {
        diag('unterminated_braced_value', i, { directive: 'body' })
      }
      i = close === -1 ? n : close
      continue
    }

    // ---- tags ----
    if (ch === '<') {
      if (/^<\/?\s*[A-Za-z\w-]*\s*$/.test(src.slice(i))) {
        mark(i, n)
        flush(); diag('unterminated_tag', i); i = n; continue
      }
      if (src.startsWith('</', i)) {
        const m = /^<\/\s*([A-Za-z][\w-]*)\s*>/.exec(src.slice(i, i + 80))
        if (m) {
          mark(i, i + m[0].length)
          let idx = -1
          for (let s = stack.length - 1; s >= 1; s--) {
            if (stack[s].kind === 'tag' && stack[s].name === m[1]) {
              idx = s
              break
            }
          }
          if (idx !== -1) {
            flush()
            const frame = stack[idx]
            frame.node.endIndex = i + m[0].length
            if (frame.name === 'AsyncImage') recordAsyncTag(frame.node)
            stack.length = idx
          }
          // unmatched closing tag -> ignore silently
          i += m[0].length
          continue
        }
      }
      const tag = tryParseOpenTag(i)
      if (tag && tag.pending) {
        mark(i, n)
        diag('unterminated_tag', i)
        i = n // drop the tail; it will parse once complete
        continue
      }
      if (tag) {
        mark(i, i + tag.consumed)
        flush()
        const node = { t: 'tag', name: tag.name, attrs: tag.attrs, children: [], startIndex: i, endIndex: -1 }
        const lc = lineCol(src, i)
        node.startLine = lc.line
        // attach at OPEN time; children fill in place, so EOF-open tags keep their content
        targetOf(top()).push(node)
        if (tag.selfClose) {
          node.endIndex = i + tag.consumed
          const elc = lineCol(src, node.endIndex)
          node.endLine = elc.line
          if (tag.name === 'AsyncImage') recordAsyncTag(node)
        } else {
          stack.push({ kind: 'tag', name: tag.name, node, children: node.children, start: i })
        }
        i += tag.consumed
        continue
      }
      buf += '<'
      i++
      continue
    }

    // ---- block control flow ----
    if (ch === '{') {
      if (src.startsWith('{#each', i)) {
        const close = scanBalancedBrace(i)
        mark(i, close === -1 ? n : close)
        if (close === -1) {
          diag('unterminated_braced_value', i)
          i = n
          break
        }
        const body = src.slice(i + 1, close - 1).replace(/^#each\s*/, '')
        const asMatch = /\s+as\s+([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*))?\s*$/.exec(body)
        flush()
        stack.push({
          kind: 'each',
          expr: (asMatch ? body.slice(0, asMatch.index) : body).trim(),
          item: asMatch?.[1] ?? 'item',
          index: asMatch?.[2] ?? null,
          children: [],
          start: i
        })
        i = close
        continue
      }
      if (src.startsWith('{/each', i)) {
        let idx = -1
        for (let s = stack.length - 1; s >= 1; s--) {
          if (stack[s].kind === 'each') {
            idx = s
            break
          }
        }
        const closeRel = /^\/each\s*\}/.exec(src.slice(i + 1, i + 12))
        const consumed = closeRel ? closeRel[0].length + 1 : 7
        mark(i, Math.min(n, i + consumed))
        if (idx !== -1) {
          flush()
          const frame = stack[idx]
          stack.length = idx
          targetOf(top()).push({
            t: 'each', expr: frame.expr, item: frame.item, index: frame.index, children: frame.children
          })
        }
        i += consumed
        continue
      }
      if (src.startsWith('{#if', i)) {
        const close = scanBalancedBrace(i)
        mark(i, close === -1 ? n : close)
        if (close === -1) {
          diag('unterminated_braced_value', i)
          i = n
          break
        }
        const cond = src.slice(i + 1, close - 1).replace(/^#if\s*/, '').trim()
        flush()
        stack.push({ kind: 'if', cond, then: [], els: [], inElse: false, start: i })
        i = close
        continue
      }
      if (src.startsWith('{:else', i)) {
        const rel = /^:else\s*\}/.exec(src.slice(i + 1, i + 10))
        mark(i, Math.min(n, i + (rel ? rel[0].length + 1 : 7)))
        for (let s = stack.length - 1; s >= 1; s--) {
          if (stack[s].kind === 'if') {
            flush()
            stack[s].inElse = true
            break
          }
        }
        i += rel ? rel[0].length + 1 : 7
        continue
      }
      if (src.startsWith('{/if', i)) {
        let idx = -1
        for (let s = stack.length - 1; s >= 1; s--) {
          if (stack[s].kind === 'if') {
            idx = s
            break
          }
        }
        const rel = /^\/if\s*\}/.exec(src.slice(i + 1, i + 8))
        const consumed = rel ? rel[0].length + 1 : 5
        mark(i, Math.min(n, i + consumed))
        if (idx !== -1) {
          flush()
          const f = stack[idx]
          stack.length = idx
          targetOf(top()).push({ t: 'if', cond: f.cond, then: f.then, els: f.els })
        }
        i += consumed
        continue
      }
      // plain {expression}
      const close = scanBalancedBrace(i)
      if (stack.length > 1 || markupEnd || isLineStart(src, i)) mark(i, close === -1 ? n : close)
      if (close === -1) {
        diag('unterminated_braced_value', i)
        i = n
        break
      }
      const expr = src.slice(i + 1, close - 1).trim()
      if (expr) pushSeg({ k: 'e', v: expr })
      i = close
      continue
    }

    // ---- markdown bold ----
    if (ch === '*' && src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2)
      if (end === -1) {
        buf += '**'
        i += 2
        continue
      }
      pushSeg({ k: 'b', v: src.slice(i + 2, end) })
      i = end + 2
      continue
    }

    buf += ch
    i++
  }
  flush()

  // ---- EOF: recover everything still open, innermost first ----
  if (stack.length > 1) markupEnd = n
  while (stack.length > 1) {
    const frame = stack.pop()
    const at = frame.start ?? 0
    if (frame.kind === 'tag') {
      diag('unterminated_tag', at)
      frame.node.endIndex = n
      const elc = lineCol(src, n)
      frame.node.endLine = elc.line
      if (frame.name === 'AsyncImage') recordAsyncTag(frame.node)
      // node was attached on open; keep it with the children collected so far
    } else if (frame.kind === 'each' || frame.kind === 'if') {
      diag('unclosed_block', at)
      const node =
        frame.kind === 'each'
          ? { t: 'each', expr: frame.expr, item: frame.item, index: frame.index, children: frame.children }
          : { t: 'if', cond: frame.cond, then: frame.then, els: frame.els }
      targetOf(top()).push(node)
    }
  }

  return { nodes: root.children, directives, diagnostics, asyncTags, markupStart, markupEnd }
}

// Use the parser's structural boundaries, not line-prefix guesses. Pending
// tags, blocks and directives keep their data/text out of conversation prose.
export function splitCardText(source) {
  source = String(source)
  const { markupStart, markupEnd } = parse(source)
  if (!markupEnd) return { intro: source.trim(), markup: '', outro: '' }
  return {
    intro: source.slice(0, markupStart).trim(),
    markup: source.slice(markupStart, markupEnd),
    outro: source.slice(markupEnd).trim(),
  }
}
