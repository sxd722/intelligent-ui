import React, { useMemo } from 'react'
import { recoveryDraft } from '../../shared/cardspec/recovery.mjs'
import './recovery.css'

export function Recovery({ source='', goal='', diagnostics=[], error='', onRetry, onEdit, busy=false, retained=false, cancelled=false, runtime=false }) {
  const draft = useMemo(() => recoveryDraft(source,goal), [source,goal])
  const details = [...new Set([...diagnostics.filter(d=>d.severity==='error').map(d=>d.message),error].filter(Boolean))]
  return <section className={`cs-recovery${retained?' cs-recovery--retained':''}`} aria-label="卡片恢复" role="status">
    <small>{cancelled?'生成已停止':retained?'更新未完成 · 保留已有预览':'简化展示 · 交互暂未就绪'}</small>
    <h3>{draft.title || '这张卡片还差一步'}</h3>
    <p>{runtime?'显示过程遇到异常。此前完成的查询或操作不会因此撤销，可修改需求或重新生成。':retained?'已有内容仍可查看，待重新生成通过校验后恢复交互。':'已保留你的需求和可读取的文字草稿。查询与操作尚未执行。'}</p>
    {!retained && <div className="cs-recovery-copy">
      {draft.goal && <details open><summary>你的需求</summary><p>{draft.goal}</p></details>}
      {draft.text.length>0 && <details open><summary>文字草稿（未经验证）</summary>{draft.text.map((text,i)=><p key={i}>{text}</p>)}</details>}
      {draft.fields.length>0 && <p>可补充的信息：{draft.fields.join('、')}</p>}
    </div>}
    <div className="cs-recovery-actions">
      {onEdit && <button type="button" disabled={busy} onClick={onEdit}>补充或修改需求</button>}
      {onRetry && <button type="button" disabled={busy} onClick={onRetry}>重新生成</button>}
    </div>
    {details.length>0 && <details><summary>查看错误详情</summary><pre>{details.join('\n')}</pre></details>}
  </section>
}

export function NodeFailure({ error, onRetry }) {
  return <div className="cs-node-recovery" role="status" data-cs-error="">
    <span>此部分暂时无法显示，其他内容可继续使用。</span>
    {onRetry && <button type="button" onClick={onRetry}>重试此部分</button>}
    <details><summary>错误详情</summary><small>{String(error?.message || error)}</small></details>
  </div>
}

// React exceptions from child widgets/effects are not caught by a parent's
// try/catch around JSX creation. A boundary keeps its siblings and store alive.
export class RenderBoundary extends React.Component {
  state = { error:null, resetKey:this.props.resetKey }
  static getDerivedStateFromError(error) { return {error} }
  static getDerivedStateFromProps(props,state) {
    return props.resetKey !== state.resetKey ? {error:null,resetKey:props.resetKey} : null
  }
  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return <NodeFailure error={this.state.error} onRetry={()=>this.setState({error:null})}/>
  }
}
