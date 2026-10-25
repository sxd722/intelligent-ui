import React,{useEffect,useMemo,useState,useCallback,useRef} from 'react'
import {createRoot} from 'react-dom/client'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {fixtureTransport} from '../shared/cardspec/baselines/fixtures.mjs'
import {CardRenderer} from './cardspec/Renderer.jsx'
import {CardSizeOverride} from './CardSize.jsx'
import {measureExperience} from './cardspec/experience-metrics.js'
import './styles/tokens.css'
import './styles/themes.css'
import './cardspec-baselines.css'
const titles={sentiment:'舆情观察',family:'亲子周末',movies:'今晚看什么',transformer:'计算显微镜',trains:'往返车票'}
const params=new URLSearchParams(location.search)
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
function App(){
 const cardRef=useRef(null),[readability,setReadability]=useState(null)
 const [data,setData]=useState(null),[error,setError]=useState(''),[id,setId]=useState(params.get('case')||'transformer'),[run,setRun]=useState(params.get('run')||'deep-baselines'),[width,setWidth]=useState(360),[size,setSize]=useState('square'),[trace,setTrace]=useState([]),[revision,setRevision]=useState(0),[note,setNote]=useState(''),[layout,setLayout]=useState(null)
 useEffect(()=>{fetch('/javascript-upgrade/results.json').then(r=>{if(!r.ok)throw Error('评估记录尚未导出');return r.json()}).then(setData).catch(e=>setError(e.message))},[])
 const [replays,setReplays]=useState([])
 useEffect(()=>{fetch('/javascript-upgrade/followup-replays.json').then(r=>r.ok?r.json():null).then(x=>setReplays(x?.replays||[])).catch(()=>{})},[])
 const entry=data?.results.find(x=>x.id===id&&x.run===run),source=entry?.output?.source
 const compiled=useMemo(()=>source?compileCard(source,{final:true,context:entry.output.spec.context}):null,[source,entry])
 const spec=useMemo(()=>compiled?.spec?{...entry.output.spec,...compiled.spec,prefetched:entry.output.spec.prefetched}:null,[compiled,entry])
 const key=`js-review:${run}:${id}:${entry?.result.sourceHash||'failed'}`
 useEffect(()=>{setNote(localStorage.getItem(key+':feedback')||'');setTrace([]);setLayout(null)},[key])
 const record=useCallback(e=>setTrace(t=>[...t.slice(-199),{at:new Date().toISOString(),...e}]),[])
 const transport=useCallback(async(payload,signal)=>{
  record({type:'tool-start',tool:payload.tool,input:payload.input})
  try{
   // Only exact-input, original-source real model responses may be replayed.
   // Changing a selection cannot accidentally reuse a different itinerary.
   if(payload.tool==='glm.generate'){
    const replay=replays.find(r=>r.run===run&&r.id===id&&r.sourceHash===entry?.result.sourceHash&&canonical(r.input)===canonical(payload.input))
    if(!replay)throw Error('当前输入没有已验证的真实模型记录；本页不会编造后续结果。原卡和选择保留。')
    signal?.throwIfAborted();record({type:'model-replay',provenance:replay.provenance,result:replay.output});return structuredClone(replay.output)
   }
   const r=await fixtureTransport(payload,signal);record({type:'tool-result',tool:payload.tool,result:r});return r
  }catch(e){record({type:'tool-error',tool:payload.tool,error:e.message});throw e}
 },[record,replays,run,id,entry])
 const download=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({run,id,result:entry?.result,note,width,size,layout,trace,source,reviewStatus:'unreviewed'},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${run}-${id}-review.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <main className="native-reference"><header><small>REAL MODEL OUTPUT / CONTROLLED TOOL DATA</small><h1>JS 作者层，能否接近 H5？</h1><p>完整模型原稿，未经人工改写。编译通过、交互正确与功能等价分别验收。</p></header>
 <nav className="reference-cases">{Object.entries(titles).map(([k,title])=><button key={k} aria-pressed={id===k} onClick={()=>setId(k)}>{title}</button>)}</nav>
 <div className="reference-controls"><label>轮次 <select aria-label="轮次" value={run} onChange={e=>setRun(e.target.value)}>{[...new Set(data?.results.map(x=>x.run)||[run])].map(r=><option key={r}>{r}</option>)}</select></label><label>宽度 <select aria-label="宽度" value={width} onChange={e=>setWidth(Number(e.target.value))}>{[320,360,432].map(w=><option key={w}>{w}</option>)}</select></label><label>尺寸 <select aria-label="尺寸" value={size} onChange={e=>setSize(e.target.value)}><option value="square">方形</option><option value="auto">自然高度</option></select></label></div>
 <p className="reference-notice">来源数据为测试替身。本页不操作 OpenCLI/Owl，也不发起模型调用；后续结果只可按完全相同的输入重放另行实测的真实 GLM 返回，交互记录明确标注。</p>
 {error&&<p role="alert">{error}</p>}
 <div className="reference-columns"><section><h2>GLM 原始生成</h2><p>{entry?`${entry.result.status==='offline-replay'?'离线重放（未调用模型）；原轮':entry.result.status} · ${(entry.result.elapsedMs/1000).toFixed(1)} 秒 · ${entry.result.budget.modelCalls} 次模型调用`:'该轮结果尚未完成'}</p>
 <div ref={cardRef} data-testid="generated-card" style={{width,maxWidth:'100%',margin:'auto'}} onClick={e=>{const button=e.target.closest('button');if(button)record({type:'click',label:button.textContent.slice(0,100)})}}>
 {compiled?.complete?<CardSizeOverride.Provider value={size}><CardRenderer key={key+revision} spec={spec} resources={entry.output.resources||{}} streaming={false} toolsReady transport={transport} persistenceKey={key} onLayout={setLayout}/></CardSizeOverride.Provider>:<p role="alert">{entry?.result.error||JSON.stringify(compiled?.diagnostics)||'等待产物'}</p>}
 </div><div className="reference-actions"><button onClick={()=>{sessionStorage.removeItem(key);setRevision(x=>x+1);record({type:'reset'})}}>重置此卡</button><a href={`/h5-baseline/index.html?case=${id}&fixtures=1&size=${size}&width=${width}`} target="_blank" rel="noreferrer">打开 H5 对照 ↗</a></div>
 <details><summary>布局测量</summary><pre data-testid="layout">{JSON.stringify(layout)}</pre></details>
 <button onClick={()=>setReadability(measureExperience(cardRef.current?.querySelector('.cs-stage')))}>测量当前视图</button><details><summary>主体可见性（不是内容质量评分）</summary><pre data-testid="experience-measurement">{JSON.stringify(readability)}</pre></details>
 </section><aside><h2>验收反馈</h2><p>先检查选择、改选、返回、恢复和异常，再评价视觉；模型的计算结果需要独立核对。</p><textarea aria-label="验收反馈" value={note} onChange={e=>{setNote(e.target.value);localStorage.setItem(key+':feedback',e.target.value)}}/><button onClick={download}>导出反馈与交互记录</button><details><summary>任务要求</summary><p>{entry?.prompt}</p></details><details><summary>生成诊断</summary><pre>{JSON.stringify(entry?.diagnostics,null,2)}</pre></details><details><summary>完整 DSL</summary><pre>{source}</pre></details><details><summary>当前编译诊断</summary><pre>{JSON.stringify(compiled?.diagnostics,null,2)}</pre></details><details><summary>交互记录 · {trace.length}</summary><pre>{JSON.stringify(trace,null,2)}</pre></details></aside></div>
 </main>
}
createRoot(document.getElementById('root')).render(<App/> )
