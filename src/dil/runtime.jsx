// DIL runtime — the client half of the pipeline.
//
// The server streams a compiled program string (metadata.model_dil_v2.code) shaped exactly
// like the reference stream:
//
//   function __dilSafe(...){...}
//   DIL.render(__dil.jsx(()=>{ ...program... },{"key":"body:N"}));
//
// We execute it with `new Function("DIL","AsyncImage", code)` (as the original does),
// provide DIL.{jsx,Fragment,render,useState,useConstants,useAppData}, map string tags to
// the host component library, and keep useState values in a keyed store so the card's
// interactive state survives the many mid-stream whole-program replacements.

import React, { useContext, useReducer, useRef } from 'react'
import { HOST_COMPONENTS, AsyncImage } from './components.jsx'

export const StreamingContext = React.createContext(false)
export const AppDataContext = React.createContext({ opGenui: { componentResults: {}, modelDataBindings: {} } })

function createRuntime(notify) {
  const stateStore = new Map()
  const constantsRef = { current: {} }
  const appDataRef = { current: { opGenui: { componentResults: {}, modelDataBindings: {} } } }
  const rendered = { element: null, key: null }

  const resolveTag = (tag) => {
    if (typeof tag !== 'string') return tag
    return HOST_COMPONENTS[tag] ?? HOST_COMPONENTS.box // unknown tag degrades to box
  }

  const DIL = {
    Fragment: React.Fragment,
    jsx(tag, props, ...children) {
      return React.createElement(resolveTag(tag), sanitizeProps(props), ...children)
    },
    render(element, opts) {
      rendered.element = element
      rendered.key = opts?.key ?? null
    },
    useState(initial, opts) {
      const key = opts?.key ?? 'state'
      if (!stateStore.has(key)) stateStore.set(key, initial)
      const value = stateStore.get(key)
      const setter = (update) => {
        const next = typeof update === 'function' ? update(stateStore.get(key)) : update
        if (!Object.is(next, stateStore.get(key))) {
          stateStore.set(key, next)
          notify()
        }
      }
      return [value, setter]
    },
    useConstants() {
      return constantsRef.current
    },
    useAppData(selector) {
      try {
        return selector(appDataRef.current) ?? {}
      } catch {
        return {}
      }
    }
  }
  return { DIL, stateStore, constantsRef, appDataRef, rendered }
}

// React reserves some prop names; our DSL never needs them on the DOM directly.
const RESERVED = new Set(['ref', 'dangerouslySetInnerHTML'])
function sanitizeProps(props) {
  if (!props) return null
  const out = {}
  for (const [k, v] of Object.entries(props)) {
    if (RESERVED.has(k)) continue
    out[k] = v
  }
  return out
}

function Markdown({ text }) {
  if (!text) return null
  return <div className="dil-fallback-md" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />
}

function mdToHtml(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  // image_group private-use markers -> local placeholder image
  const lines = []
  for (const line of src.split('\n')) {
    const m = /\ue200image_group\ue202(.*?)\ue201/.exec(line)
    if (m) {
      try {
        const spec = JSON.parse(m[1])
        const q = spec.query?.[0] ?? ''
        let h = 0
        for (let i = 0; i < q.length; i++) h = (h * 31 + q.charCodeAt(i)) >>> 0
        const label = encodeURIComponent(q.slice(0, 40))
        lines.push(`<img class="dil-fb-img" src="/api/image?seed=${h}&w=640&h=360&label=${label}" alt="" />`)
      } catch {
        /* ignore */
      }
      continue
    }
    if (/^###\s/.test(line)) lines.push(`<h3>${inline(line.slice(4))}</h3>`)
    else if (/^##\s/.test(line)) lines.push(`<h2>${inline(line.slice(3))}</h2>`)
    else if (/^#\s/.test(line)) lines.push(`<h1>${inline(line.slice(2))}</h1>`)
    else if (/^---\s*$/.test(line)) lines.push('<hr/>')
    else if (/^- \[ \] /.test(line)) lines.push(`<div class="dil-fb-task">${inline(line.slice(6))}</div>`)
    else if (line.trim() === '') lines.push('')
    else lines.push(`<p>${inline(line)}</p>`)
  }
  return lines.join('\n')
}

export function DilCard({ dil, streaming = false }) {
  const [, force] = useReducer((x) => x + 1, 0)
  const rtRef = useRef(null)
  const fnCacheRef = useRef(new Map())

  if (!rtRef.current) rtRef.current = createRuntime(force)
  const rt = rtRef.current

  rt.constantsRef.current = dil?.constants ?? {}
  rt.appDataRef.current = dil?.appData ?? { opGenui: { componentResults: {}, modelDataBindings: {} } }

  let element = null
  let execError = null
  if (dil?.code) {
    try {
      let fn = fnCacheRef.current.get(dil.code)
      if (!fn) {
        fn = new Function('DIL', 'AsyncImage', dil.code)
        fnCacheRef.current.set(dil.code, fn)
      }
      rt.rendered.element = null
      fn(rt.DIL, AsyncImage)
      element = rt.rendered.element
      if (!element) execError = new Error('program produced no element')
    } catch (e) {
      execError = e
    }
  }

  if (!dil || !dil.code || execError) {
    // degradation chain: DIL -> fallbackMarkdown -> nothing
    return <Markdown text={dil?.fallbackMarkdown} />
  }

  return (
    <AppDataContext.Provider value={rt.appDataRef.current}>
      <StreamingContext.Provider value={!!streaming}>
        <div className={`dil-card${streaming ? ' dil-card--streaming' : ''}`}>{element}</div>
      </StreamingContext.Provider>
    </AppDataContext.Provider>
  )
}
