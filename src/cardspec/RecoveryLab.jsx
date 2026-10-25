import React, { useState } from 'react'
import { AssistantTurn } from '../App.jsx'
import { RenderBoundary } from './Recovery.jsx'
import { CardRenderer } from './Renderer.jsx'
import { compileCard } from '../../shared/cardspec/compiler.mjs'
import { FAILED_TRAIN_SOURCE } from '../../shared/cardspec/recovery-train-fixture.mjs'
import { ToolSettings } from './ToolCard.jsx'

export const ISOLATION_SOURCE = `<card><state id="broken" type="boolean" initial={false}/><state id="count" type="number" initial={0}/><state id="note" type="string" initial=""/>
<title>局部故障隔离</title><input label="保留的备注" value={state.note} onChange="edit"/><text>正常计数 {state.count}</text>
<row><button onPress="add">计数加一</button><button onPress="break">触发局部故障</button><button onPress="heal">恢复局部内容</button></row>
<if test={state.broken ? sum(1)>0 : true}><text>条件区域正常</text></if>
<text visible={state.broken ? sum(1)>0 : true}>可见性区域正常</text>
<text>正常尾部始终可见</text>
<action id="edit"><set target="note" value={event.value}/></action><action id="add"><set target="count" value={state.count+1}/></action><action id="break"><set target="broken" value={true}/></action><action id="heal"><set target="broken" value={false}/></action></card>`
const compiled=compileCard(FAILED_TRAIN_SOURCE,{final:true})
const goal='明天的G1386以及我从金辰之光出发应该怎么安排行程'
const turn={id:'recovery-replay',format:'cardspec',status:'failed',startedAt:0,error:'CardSpec validation failed',phases:[{id:'replay',phase:'dsl',kind:'cardspec',title:'G1386 · 原始失败记录回放',status:'failed',live:false,message:{status:'failed',content:{parts:[FAILED_TRAIN_SOURCE]},metadata:{format:'cardspec',diagnostics:compiled.diagnostics}}}]}
function BrokenWidget({broken}){if(broken)throw new Error('测试组件 render 异常');return <p>组件已恢复</p>}
function BoundaryProbe(){
  const [broken,setBroken]=useState(false),[count,setCount]=useState(0),[note,setNote]=useState('')
  return <section aria-label="React 组件边界测试"><h2>React 子组件异常</h2>
    <label>独立备注<input value={note} onChange={e=>setNote(e.target.value)}/></label>
    <button onClick={()=>setCount(n=>n+1)}>独立计数 {count}</button>
    <button onClick={()=>setBroken(true)}>触发 React 异常</button><button onClick={()=>setBroken(false)}>解除 React 异常</button>
    <RenderBoundary resetKey={broken}><BrokenWidget broken={broken}/></RenderBoundary>
  </section>
}
export function RecoveryLab(){
  const [draft,setDraft]=useState(''),[notice,setNotice]=useState(''),[width,setWidth]=useState(432)
  const spec=compileCard(ISOLATION_SOURCE,{final:true,cardId:'isolation-test'}).spec
  return <ToolSettings.Provider value={false}><main style={{maxWidth:900,margin:'auto',padding:16,fontFamily:'system-ui'}}>
    <h1>卡片恢复回归</h1><p>原始失败源码回放；下方故障为主动注入的测试。此页不调用模型或 CLI。</p>
    <label>测试宽度 <select value={width} onChange={e=>setWidth(Number(e.target.value))}>{[320,360,432].map(n=><option key={n}>{n}</option>)}</select></label>
    <div style={{width,maxWidth:'100%',margin:'auto'}}><AssistantTurn turn={turn} goal={goal} onTelemetry={()=>{}} onEdit={()=>setDraft(goal)} onRetry={()=>setNotice('已请求重新生成（回放测试不调用模型）')}/></div>
    <label>修改后的需求<textarea value={draft} onChange={e=>setDraft(e.target.value)}/></label><p role="status">{notice}</p>
    <div style={{width,maxWidth:'100%',margin:'24px auto'}}><CardRenderer spec={spec} toolsReady={false}/></div>
    <BoundaryProbe/>
  </main></ToolSettings.Provider>
}
