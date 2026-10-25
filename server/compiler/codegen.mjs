// Compiles the parsed DIL AST into the program shape used by the reference stream:
//
//   function __dilSafe(evaluate,failureValue){try{return evaluate()}catch{return failureValue}}
//
//   DIL.render(DIL.jsx(()=>{
//   const __dilConstants=DIL.useConstants();
//   const __dilModelDataBindings=DIL.useAppData((appData)=>appData.opGenui?.modelDataBindings??{});
//   <transformed {@body} directives>
//   return DIL.jsx(__dil.Fragment,null,...);
//   },{"key":"body:N"}));
//
// Rules mirrored from the reference deltas:
//   - static text is hoisted into a `constants` table and referenced as __dilConstants["k"]
//   - every dynamic expression is wrapped in __dilSafe(()=>(expr), fallback)
//   - {#each} compiles to .map(), {#if} compiles to a ternary, **bold** to a nested <text><bold>
//   - DIL.useState(init) gains a stable {key} inferred from the destructure name
//   - AsyncImage tags gain __resolutionId pointing at a constants entry holding a server uuid

const PUA_START = '\ue200'
const PUA_MID = '\ue202'
const PUA_END = '\ue201'

export function compile(parsed, opts = {}) {
  const constantsByValue = new Map()
  let nextConstId = 0
  const constRef = (value) => {
    const s = typeof value === 'string' ? value : String(value)
    if (!constantsByValue.has(s)) constantsByValue.set(s, String(nextConstId++))
    return `__dilConstants[${JSON.stringify(constantsByValue.get(s))}]`
  }

  const asyncImages = []

  // ---------- helpers ----------

  function splitExprs(text) {
    const parts = []
    let buf = ''
    let i = 0
    while (i < text.length) {
      if (text[i] === '{') {
        let depth = 0
        let j = i
        for (; j < text.length; j++) {
          if (text[j] === '{') depth++
          else if (text[j] === '}') {
            depth--
            if (depth === 0) break
          }
        }
        if (j >= text.length) {
          buf += text.slice(i)
          break
        }
        if (buf) {
          parts.push({ text: buf })
          buf = ''
        }
        parts.push({ expr: text.slice(i + 1, j).trim() })
        i = j + 1
      } else {
        buf += text[i]
        i++
      }
    }
    if (buf) parts.push({ text: buf })
    return parts
  }

  const exprCode = (expr, fallback = 'null') => `__dilSafe(()=>(${expr}),${fallback})`

  function segsCode(segs) {
    return segs.map((seg) => {
      if (seg.k === 's') return constRef(seg.v)
      if (seg.k === 'e') return exprCode(seg.v)
      // bold run: inner text may itself contain {expr}
      const inner = splitExprs(seg.v)
        .map((p) => (p.expr ? exprCode(p.expr) : constRef(p.text)))
        .join(',')
      return `DIL.jsx("bold",null,${inner})`
    })
  }

  function childrenCode(children) {
    return children.map(nodeCode).filter(Boolean)
  }

  function blockRoot(children) {
    const kids = childrenCode(children)
    if (!kids.length) return 'null'
    if (kids.length === 1) return kids[0]
    return `DIL.jsx(DIL.Fragment,null,${kids.join(',')})`
  }

  // collect segs from a <text> tag whose content is only nested <text> tags
  // (and raw runs). Returns null when any non-text element child exists.
  function flattenTextSegs(node) {
    const out = []
    const walk = (n) => {
      for (const c of n.children) {
        if (c.t === 'text') out.push(...c.segs)
        else if (c.t === 'tag' && c.name === 'text') {
          if (!walk(c)) return false
        } else return false
      }
      return true
    }
    if (!walk(node)) return null
    return out
  }

  function attrValueCode(attr) {
    if (attr.form === 'str') return JSON.stringify(attr.value)
    // embedded {expr} runs inside a quoted attribute -> string concatenation
    if (attr.form === 'segs') {
      return (
        attr.value
          .map((p) =>
            p.t === 's'
              ? JSON.stringify(p.v)
              : `__dilSafe(()=>(${p.v}),'')`
          )
          .join(' + ') || '""'
      )
    }
    if (attr.form === 'bare') {
      if (attr.value === true) return 'true'
      if (/^-?\d+(\.\d+)?$/.test(attr.value)) return attr.value
      return JSON.stringify(attr.value)
    }
    const v = attr.value
    if (/^\s*(\([^()]*\)\s*=>|[\w$]+\s*=>|async\s)/.test(v)) return `(${v})`
    return `__dilSafe(()=>(${v}),undefined)`
  }

  function tagCode(node) {
    // models nest <text> inside <text> often; that renders invalid nested <p>.
    // flatten pure text-in-text into a single <text> carrying the outer attrs.
    if (node.name === 'text') {
      const segs = flattenTextSegs(node)
      if (segs) {
        const entries = []
        for (const a of node.attrs) {
          if (a.form === 'segs' || a.form === 'expr' || a.value === true) {
            entries.push(`${JSON.stringify(a.name)}:${attrValueCode(a)}`)
          } else if (a.value !== true) {
            entries.push(`${JSON.stringify(a.name)}:${attrValueCode(a)}`)
          }
        }
        const props = entries.length ? `{${entries.join(',')}}` : 'null'
        if (!segs.length) return null
        return `DIL.jsx("text",${props},${segsCode(segs).join(',')})`
      }
    }
    const isAsync = node.name === 'AsyncImage'
    const entries = []
    const statics = {}
    for (const a of node.attrs) {
      entries.push(`${JSON.stringify(a.name)}:${attrValueCode(a)}`)
      if (a.form !== 'expr' && a.value !== true) statics[a.name] = a.value
      else if (a.value === true) statics[a.name] = true
    }
    if (isAsync) {
      const key = JSON.stringify([statics.query ?? '', statics.aspectRatio ?? ''])
      const uuid = opts.resolveImage ? opts.resolveImage(key, statics) : `pending-${asyncImages.length}`
      entries.push(`"__resolutionId":${constRef(uuid)}`)
      asyncImages.push({
        resolutionId: uuid,
        attrs: statics,
        startIndex: node.startIndex ?? 0,
        endIndex: node.endIndex ?? -1,
        startLine: node.startLine ?? 0,
        endLine: node.endLine ?? 0
      })
    }
    const props = entries.length ? `{${entries.join(',')}}` : 'null'
    const kids = childrenCode(node.children)
    const nameCode = isAsync ? 'AsyncImage' : JSON.stringify(node.name)
    if (!kids.length) return `DIL.jsx(${nameCode},${props})`
    return `DIL.jsx(${nameCode},${props},${kids.join(',')})`
  }

  function nodeCode(node) {
    if (node.t === 'text') {
      const dynamic = node.segs.some((s) => s.k !== 's')
      if (!dynamic) {
        // whitespace-only runs between tags are layout noise, not content (observed behaviour)
        if (node.segs.every((s) => !s.v.trim())) return null
        return node.segs.map((s) => constRef(s.v)).join(',')
      }
      return `DIL.jsx("text",{"inline":true},${segsCode(node.segs).join(',')})`
    }
    if (node.t === 'tag') return tagCode(node)
    if (node.t === 'each') {
      const idx = node.index ? `,${node.index}` : ''
      return `__dilSafe(()=>((${node.expr}).map((${node.item}${idx})=>${blockRoot(node.children)})),null)`
    }
    if (node.t === 'if') {
      const thenRoot = blockRoot(node.then)
      const elseRoot = node.els.length ? blockRoot(node.els) : 'null'
      return `(${exprCode(node.cond, 'false')}?(${thenRoot}):(${elseRoot}))`
    }
    return null
  }

  // ---------- {@body} directive transform: inject stable useState keys ----------

  function transformDirective(code) {
    const marker = 'DIL.useState('
    let out = ''
    let i = 0
    let autoKey = 0
    while (i < code.length) {
      const at = code.indexOf(marker, i)
      if (at === -1) {
        out += code.slice(i)
        break
      }
      const open = at + marker.length - 1
      let depth = 0
      let close = -1
      for (let j = open; j < code.length; j++) {
        if (code[j] === '(') depth++
        else if (code[j] === ')') {
          depth--
          if (depth === 0) {
            close = j
            break
          }
        }
      }
      out += code.slice(i, open + 1)
      if (close === -1) {
        out += code.slice(open + 1)
        break
      }
      const argsSrc = code.slice(open + 1, close)
      const before = code.slice(Math.max(0, at - 80), at)
      const destr = /const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*[A-Za-z_$][\w$]*\s*\]\s*=\s*$/.exec(before)
      const key = destr ? destr[1] : `state${autoKey++}`
      const alreadyKeyed = /,\s*\{[^{}]*key\s*:/.test(argsSrc)
      let args = argsSrc.trim()
      if (!alreadyKeyed) args = (args ? `${args},` : '') + `{key:${JSON.stringify(key)}}`
      out += args
      i = close
    }
    return out
  }

  // ---------- assemble program ----------

  const directiveLines = parsed.directives.map((d) => transformDirective(d.code))
  const rootCode = blockRoot(parsed.nodes)
  const programKey = `body:${parsed.directives.length}`

  const code =
    `function __dilSafe(evaluate,failureValue){try{return evaluate()}catch{return failureValue}}\n\n` +
    `DIL.render((()=>{const __dilConstants=DIL.useConstants();` +
    `const __dilModelDataBindings=DIL.useAppData((appData)=>appData.opGenui?.modelDataBindings??{});` +
    `${directiveLines.join('\n')}${directiveLines.length ? '\n' : ''}` +
    `return ${rootCode};` +
    `})(),${JSON.stringify({ key: 'body' })});`

  // ---------- fallback markdown (parallel degradation channel) ----------

  function inlineOf(segs) {
    return segs
      .map((s) => {
        if (s.k === 's') return s.v
        if (s.k === 'b') return `**${s.v}**`
        return '' // dynamic values render empty in the fallback (observed behaviour)
      })
      .join('')
  }

  function fallbackWalk(nodes) {
    const blocks = []
    for (const node of nodes) {
      if (node.t === 'text') {
        const text = inlineOf(node.segs).trim()
        if (text) blocks.push(text)
      } else if (node.t === 'tag') {
        const name = node.name
        if (name === 'AsyncImage') {
          const q = node.attrs.find((a) => a.name === 'query')?.value ?? ''
          const ratio = node.attrs.find((a) => a.name === 'aspectRatio')?.value ?? '16:9'
          blocks.push(
            `${PUA_START}image_group${PUA_MID}${JSON.stringify({
              query: [q],
              aspect_ratio: ratio,
              layout: 'carousel',
              num_per_query: 1
            })}${PUA_END}`
          )
        } else if (name === 'title') {
          const size = node.attrs.find((a) => a.name === 'size')?.value ?? 'md'
          const hashes = ['sm', 'md', 'lg'].includes(size) ? '##' : '#'
          blocks.push(`${hashes} ${inlineOf(collectText(node.children))}`)
        } else if (name === 'divider') {
          blocks.push('---')
        } else if (['icon', 'spacer', 'input', 'textarea'].includes(name)) {
          // skip chrome
        } else if (['badge', 'button', 'pressable'].includes(name)) {
          blocks.push(`**${inlineOf(collectText(node.children)).trim()}**`)
        } else if (name === 'checkbox') {
          blocks.push(`- [ ] ${inlineOf(collectText(node.children)).trim()}`)
        } else {
          const inner = fallbackWalk(node.children)
          if (inner.trim()) blocks.push(inner)
        }
      } else if (node.t === 'each' || node.t === 'if') {
        const inner = fallbackWalk(node.children ?? node.then)
        if (inner.trim()) blocks.push(inner)
        if (node.t === 'if' && node.els.length) {
          const els = fallbackWalk(node.els)
          if (els.trim()) blocks.push(els)
        }
      }
    }
    return blocks.filter((b) => b !== undefined).join('\n\n')
  }

  function collectText(children) {
    const parts = []
    for (const c of children) {
      if (c.t === 'text') parts.push(c.segs)
      else if (c.t === 'tag') parts.push(...collectTextTag(c))
      else if (c.t === 'each' || c.t === 'if') parts.push(...collectText(c.children ?? c.then))
    }
    // flatten: array of seg-arrays -> single seg list
    return parts.flat().map((s, _i, arr) => s).filter((s) => s && s.k).map((s) => s)
  }

  function collectTextTag(node) {
    if (['bold', 'italic', 'underline', 'text', 'title', 'caption', 'label', 'badge', 'button', 'pressable', 'checkbox'].includes(node.name)) {
      return collectText(node.children)
    }
    return []
  }

  const constants = {}
  for (const [value, id] of constantsByValue) constants[id] = value

  return {
    code,
    constants,
    fallbackMarkdown: fallbackWalk(parsed.nodes),
    programKey,
    asyncImages,
    directiveCount: parsed.directives.length
  }
}
