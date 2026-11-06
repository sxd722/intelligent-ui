import React,{useEffect,useRef,useState} from 'react'
export function SameKind({source,spec,resources,busy,onResult,onNormal,available=true,browserValidation=false}){
 const [open,setOpen]=useState(false),[prompt,setPrompt]=useState(''),[baseline,setBaseline]=useState(null),[phase,setPhase]=useState(''),[error,setError]=useState('')
 const active=useRef(null)
 useEffect(()=>()=>{active.current?.abort();active.current=null},[])
 useEffect(()=>{setBaseline(null);active.current?.abort();active.current=null;setPhase('')},[source])
 async function run(){
  if(!available||!prompt.trim()||active.current||busy)return
  const controller=new AbortController();active.current=controller;setError('')
  const post=async(path,body)=>{const response=await fetch('/api/cards/same-kind/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'同款生成失败');return data}
  let verifier
  try{
   if(browserValidation){const {createReuseVerifier}=await import('./same-kind-verifier.mjs');verifier=await createReuseVerifier(controller.signal)}
   let pack=baseline
   if(!pack){setPhase('首次确认原卡验证记录与关键交互…');pack=await post('prepare',{source,spec,resources});if(active.current!==controller)return;setBaseline(pack)}
   if(verifier&&!pack.browser){setPhase('在浏览器验证原卡交互与状态恢复…');pack={...pack,browser:await verifier.verify(pack.spec)};setBaseline(pack)}
   setPhase('替换内容 → 验证受影响内容与关键交互（跳过规划）…')
   const result=await post('generate',{baselineId:pack.id,prompt,modelProfile:spec.context?.modelProfile})
   if(active.current!==controller)return
   if(verifier){setPhase('验证新卡：432/320px、关键交互与恢复…');result.browserValidation=await verifier.verify(result.spec,pack.browser);result.spec.sameKind.browserStatus='passed';result.spec.sameKind.browserValidation=result.browserValidation}
   if(active.current!==controller)return
   onResult?.(result,prompt);setOpen(false);setPrompt('')
  }catch(e){if(active.current===controller&&!controller.signal.aborted){setError(e.message);setBaseline(null)}}finally{verifier?.dispose();if(active.current===controller){active.current=null;setPhase('')}}
 }
 const cancel=()=>{active.current?.abort();active.current=null;setPhase('')}
 return <section className="same-kind card-prose" aria-label="做同款">
  <button disabled={busy||!!phase} onClick={()=>setOpen(!open)} aria-expanded={open}>{available?'做同款 · 替换内容':'做同款 · 云端暂不可用'}</button>
  {!available&&<small role="note">云端尚未接入原卡验证记录和浏览器交互回归。可展开后改用正常生成；不会复用原卡布局或修改原卡。</small>}
  {open&&<div style={{display:'grid',gap:8,padding:'12px 0'}}>
   {available&&<small>复用布局、交互和工具绑定。首版保留条目数量与稳定 ID；结构、公式或新功能变化请正常生成。不会修改原卡。</small>}
   <textarea aria-label="同款替换要求" value={prompt} onChange={e=>setPrompt(e.target.value)} disabled={!!phase} placeholder="例如：保持交互，把三道知识题替换为太阳系主题…" rows={3}/>
   <div role="status">{phase}</div>
   {error&&<div role="alert">{error}</div>}
   <div style={{display:'flex',gap:8}}>{phase?<button onClick={cancel}>取消同款</button>:available&&<button disabled={!prompt.trim()||busy} onClick={run}>生成同款</button>}
    {!phase&&(error||!available)&&onNormal&&<button disabled={!prompt.trim()||busy} onClick={()=>onNormal(prompt)}>改用正常生成</button>}</div>
  </div>}
 </section>
}
