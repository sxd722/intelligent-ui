import React, {useEffect,useMemo,useRef,useState} from 'react'
import {isControlEvent} from './delta.js'
import {StreamCot} from './StreamCot.jsx'

function classifyFrame(f) {
  if (f && f.type === 'stream_error') return 'error'
  if (f && (f.type === 'phase_begin' || f.type === 'phase_end')) return 'control'
  if (isControlEvent(f)) return 'control'
  if (Array.isArray(f.v)) return 'patch'
  if (f.v !== undefined && f.p === undefined && f.o === undefined) return 'shorthand'
  return 'patch'
}

export function Inspector({ frames, current, exportTrace, narrative }) {
  const [tab, setTab] = useState('frames')
  const framesRef = useRef(null)
  const follow = useRef(true)
  useEffect(() => {
    if (follow.current && (tab === 'frames' || tab === 'cot') && framesRef.current) {
      framesRef.current.scrollTop = framesRef.current.scrollHeight
    }
  }, [frames, narrative?.revision, tab])
  const selectTab = (value) => { follow.current = true; setTab(value) }

  const dil = current?.message?.metadata?.model_dil_v2
  const spec = current?.message?.metadata?.card_spec
  const programKey = useMemo(() => {
    const m = /"key":"(body:\d+)"/.exec(dil?.code ?? '')
    return m ? m[1] : '—'
  }, [dil?.code])
  const constants = dil?.constants ?? {}

  return (
    <aside className="inspector-body" aria-label="Stream inspector">
      <div className="tabs" role="tablist" aria-label="Stream 视图">
        {['cot', 'frames', 'compiled', 'source', 'fallback', 'diagnostics'].map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} role="tab" aria-selected={tab === t} aria-controls="stream-panel" id={`stream-tab-${t}`} onClick={() => selectTab(t)}>
            {t}
          </button>
        ))}
        <button className="tab" onClick={exportTrace}>导出</button>
      </div>
      <div key={tab} id="stream-panel" role="tabpanel" aria-labelledby={`stream-tab-${tab}`} className="panel" ref={framesRef} tabIndex={0} onScroll={e => { const el=e.currentTarget; follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<40 }}>
        {tab === 'cot' && <StreamCot narrative={narrative}/>}

        {tab === 'frames' ? (
          frames.length === 0 ? (
            <div style={{ color: 'var(--color-text-tertiary)' }}>no frames yet — send a message</div>
          ) : (
            frames.map((f, i) => <pre key={i} className={`frame frame--${classifyFrame(f)}`}>{JSON.stringify(f)}</pre>)
          )
        ) : null}
        {tab === 'compiled' ? (
          spec ? <div className="code-view">{JSON.stringify(spec, null, 2)}</div> : !dil ? (
            <div style={{ color: 'var(--color-text-tertiary)' }}>no compiled program yet</div>
          ) : (
            <>
              <div className="kv">
                <b>program key</b>
                <span>{programKey}</span>
                <b>constants</b>
                <span>{Object.keys(constants).length} entries</span>
                <b>required</b>
                <span>{(dil.requiredComponents ?? []).join(', ') || '—'}</span>
                <b>diagnostics</b>
                <span>
                  {(dil.recoveryDiagnostics ?? []).map((d, i) => (
                    <span key={i} className="diag-pill">
                      {d.code} @{d.line}:{d.column}
                    </span>
                  ))}
                  {!(dil.recoveryDiagnostics ?? []).length ? 'clean' : null}
                </span>
                <b>appData</b>
                <span>{Object.keys(dil.appData?.opGenui?.componentResults ?? {}).length} async component(s)</span>
              </div>
              <div className="code-view">{dil.code}</div>
            </>
          )
        ) : null}
        {tab === 'source' ? (
          <div className="src-view">{(current?.message?.content?.parts?.[0] ?? '').trim() || '— empty —'}</div>
        ) : null}
        {tab === 'fallback' ? (
          <div className="src-view">{(dil?.fallbackMarkdown ?? '').trim() || '— empty —'}</div>
        ) : null}
        {tab === 'diagnostics' && <div className="code-view">{JSON.stringify(current?.message?.metadata?.diagnostics || dil?.recoveryDiagnostics || [], null, 2)}</div>}
      </div>
    </aside>
  )
}
