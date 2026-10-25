import React from 'react'
import './styles/thinking.css'

export function Thinking({ placement = 'phase', empty = false }) {
  return <div className={`thinking thinking--${placement}${empty ? ' thinking--empty' : ''}`} role="status" aria-live="polite" aria-label="正在思考并生成">
    <span className="thinking-dots" aria-hidden="true"><i/><i/><i/></span>
    <span>Thinking<span aria-hidden="true">…</span></span>
  </div>
}
