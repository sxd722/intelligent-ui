import React,{useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Markdown} from './md.jsx'
import {RsiFeedback} from './RsiFeedback.jsx'
import {CardRenderer} from './cardspec/Renderer.jsx'
import {ToolSettings} from './cardspec/ToolCard.jsx'
import {CardSizeOverride} from './CardSize.jsx'
import {SandboxSettings} from './SandboxMode.jsx'
import './styles/tokens.css'
import './styles/dil.css'
import './styles/themes.css'
const read=async u=>{const r=await fetch(u);if(!r.ok)throw Error((await r.json()).error||'读取失败');return r.json()}
function App(){
 const [list,setList]=useState([]),[id,setId]=useState(new URLSearchParams(location.search).get('id')||''),[data,setData]=useState(null),[error,setError]=useState(''),[preview,setPreview]=useState(false)
 useEffect(()=>{read('/api/rsi-journal').then(setList).catch(e=>setError(e.message))},[])
 useEffect(()=>{if(!id)return;let live=true;setData(null);setPreview(false);setError('');Promise.all(['','/models','/frames','/results'].map(s=>read('/api/rsi-journal/'+encodeURIComponent(id)+s))).then(([record,models,frames,results])=>{if(live)setData({record,models,frames,results})}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[id])
 const products=data?.results.flatMap(r=>r.results||r.result?.results||[r.result]).filter(Boolean)||[],spec=products.findLast(p=>p.spec)?.spec
 const calls=data?.models.filter(m=>m.type!=='start')||[],parent=data?.record.parentId
 const toolFrames=data?.frames.filter(e=>/tool|research|discovery|component|diagnostic|debug/.test(JSON.stringify(e.frame?.type||'')))||[]
 return <main style={{maxWidth:1200,margin:'24px auto',padding:20,fontFamily:'system-ui',color:'#e8eef8',background:'#151d2e',borderRadius:20}}><h1>RSI 生成档案</h1><p>生成、重试、交互与反馈保留为独立证据。建议不会自动修改系统。</p>
  <select aria-label="选择生成记录" value={id} style={{maxWidth:'100%'}} onChange={e=>{setId(e.target.value);history.replaceState(null,'','?id='+e.target.value)}}><option value="">选择记录</option>{list.map(r=><option value={r.id} key={r.id}>{r.createdAt} · {r.status} · {(r.prompt||'工具执行').slice(0,65)}</option>)}</select>
  {error&&<p role="alert">{error}</p>}{data&&<><p>{data.record.status} · {data.record.createdAt} {parent&&<a href={'?id='+parent}>父记录</a>}</p><nav>{list.filter(r=>r.parentId===id).map(r=><a style={{marginRight:12}} key={r.id} href={'?id='+r.id}>后续生成 {r.createdAt}</a>)}</nav>
  <details open><summary>用户 prompt</summary><Markdown text={data.record.prompt}/></details>
  <details><summary>模型输出 / CoT · {calls.length} 次调用</summary>{calls.map((c,i)=><section key={i}><h3>{i+1} · {c.result?.model||c.type} · {c.elapsedMs}ms</h3><small>{JSON.stringify(c.usage)}</small><Markdown text={c.result?.message?.reasoning_content||c.partial?.map(p=>p.reasoning||'').join('')||'未返回 reasoning 内容'}/><details><summary>正文与 tool calls</summary><pre>{JSON.stringify(c.result?.message||c.partial,null,2)}</pre></details></section>)}</details>
  <details><summary>工具/UI 召回、调试与元数据</summary><pre>{JSON.stringify({toolFrames,specMetadata:spec?{toolDiscovery:spec.toolDiscovery,componentDisclosure:spec.componentDisclosure,toolBindingPlan:spec.toolBindingPlan,research:spec.research,generationDebug:spec.generationDebug}:null},null,2)}</pre></details>
  <details><summary>生成产物 · {products.length}</summary><pre>{JSON.stringify(products,null,2)}</pre>{spec&&<><button onClick={()=>setPreview(!preview)}>查看交互回放（不执行真实工具）</button>{preview&&<ToolSettings.Provider value={false}><SandboxSettings.Provider value={spec.context?.renderMode||'native'}><CardSizeOverride.Provider value="full"><CardRenderer key={id} spec={{...spec,context:{...spec.context,rsiRecordId:undefined,archiveReplay:true}}} resources={products.findLast(p=>p.spec)?.resources||{}} toolsReady={false}/></CardSizeOverride.Provider></SandboxSettings.Provider></ToolSettings.Provider>}</>}</details>
  {data.record.stitchId&&<details><summary>Stitch mock</summary><img style={{maxWidth:432,width:'100%'}} src={'/api/stitch-comparisons/'+data.record.stitchId+'/image'} alt="Stitch 设计对照"/></details>}
  <details><summary>用户交互记录 · {data.record.interactions.length}</summary><pre>{JSON.stringify(data.record.interactions,null,2)}</pre></details><RsiFeedback key={id} id={id} ready/>
  <p><a href={'/api/rsi-journal/'+id+'/models'}>完整模型记录 JSON</a> · <a href={'/api/rsi-journal/'+id+'/frames'}>完整 SSE trace</a></p></>}
  <style>{'pre{white-space:pre-wrap;overflow:auto;max-height:540px;overflow-wrap:anywhere}details{padding:12px 0;border-bottom:1px solid #ffffff20}summary,button{cursor:pointer}a{color:#a8d6ff}textarea{box-sizing:border-box}'}</style>
 </main>
}
createRoot(document.getElementById('root')).render(<App/> )
