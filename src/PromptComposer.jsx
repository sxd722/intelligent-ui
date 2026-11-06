import React,{useEffect,useRef,useState} from 'react'
import './styles/refine-prompt.css'

// A new external draft remounts this component. In-flight refinements can never
// overwrite an example, another request, or the user's edited review prompt.
export default function PromptComposer({input,onChange,onGenerate,streaming,onStop,modelProfile,cardSize,renderMode,toolsEnabled,designPreference,designMode,format}){
 const [phase,setPhase]=useState('draft'),[error,setError]=useState('')
 const [refineEnabled,setRefineEnabled]=useState(()=>{try{return localStorage.getItem('cardspec-refine-prompt')!=='off'}catch{return true}})
 const active=useRef(null),textarea=useRef(null)
 useEffect(()=>()=>{active.current?.abort();active.current=null},[])
 async function refine(){
  if(!input.trim()||streaming||active.current)return
  const controller=new AbortController();active.current=controller;setPhase('refining');setError('')
  try{
   const response=await fetch('/api/refine-prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:input,modelProfile,cardSize,renderMode,toolsEnabled,designPreference,designMode,format}),signal:controller.signal})
   const result=await response.json()
   if(!response.ok||typeof result.prompt!=='string'||!result.prompt.trim())throw Error(result.error||'需求提炼未返回规划')
   if(active.current!==controller)return
   onChange(result.prompt);setPhase('review');requestAnimationFrame(()=>textarea.current?.focus())
  }catch(e){if(active.current===controller&&!controller.signal.aborted){setError(e.message||'需求提炼失败，请重试');setPhase('draft')}}
  finally{if(active.current===controller)active.current=null}
 }
 function cancel(){active.current?.abort();active.current=null;setPhase('draft')}
 function toggleRefine(enabled){
  cancel();setError('');setRefineEnabled(enabled)
  try{localStorage.setItem('cardspec-refine-prompt',enabled?'on':'off')}catch{/* The current selection still works without storage. */}
 }
 function submit(){if(!input.trim()||streaming||phase==='refining')return;if(!refineEnabled||phase==='review')onGenerate(input);else refine()}
 return <>
  <div className="refine-status" role="status" aria-live="polite">{!refineEnabled?'直接使用输入内容生成':phase==='refining'?'正在 refine prompt…':phase==='review'?'规划已就绪 · 可编辑后确认生成':'1 提炼需求 → 2 编辑规划并生成'}</div>
  {error&&<div role="alert" className="refine-error">{error}</div>}
  <div className="composer-inner">
   <textarea ref={textarea} aria-label="卡片生成需求" rows={phase==='review'?7:2} value={input} disabled={phase==='refining'||streaming} placeholder="描述你想要的交互卡片…" onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&phase==='draft'){e.preventDefault();submit()}}}/>
   {streaming?<button className="stop-btn" onClick={onStop}>停止</button>:phase==='refining'?<button className="stop-btn" onClick={cancel}>取消提炼</button>:<button className="send-btn" disabled={!input.trim()} onClick={submit}>{!refineEnabled?'发送':phase==='review'?'确认并生成':'提炼需求'}</button>}
  </div>
  <div className="composer-options">
   <label className="refine-option"><input type="checkbox" checked={refineEnabled} disabled={streaming} onChange={e=>toggleRefine(e.target.checked)}/>Refine prompt（先提炼需求）</label>
   {refineEnabled&&phase==='review'&&!streaming&&<button className="refine-again" onClick={refine}>重新提炼</button>}
  </div>
 </>
}
