import React,{useEffect,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from './Renderer.jsx'
import {CardSizeOverride} from '../CardSize.jsx'
import {collectImages} from '../../shared/cardspec/images.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {TOOL_PAGE,TOOL_SLOT} from '../../shared/cardspec/tool-fixtures.mjs'
import {measureExperience} from './experience-metrics.js'
import '../styles/tokens.css'
import '../styles/themes.css'
function Qa(){
 const [samples,setSamples]=useState([]),[index,setIndex]=useState(0),[running,setRunning]=useState(false),[results,setResults]=useState([]),[width,setWidth]=useState(320),[size,setSize]=useState('square'),box=useRef(null),recorded=useRef('')
 useEffect(()=>{fetch('/experience-qa-samples.json').then(r=>r.json()).then(setSamples)},[])
 const sample=samples[index],matrix=[...samples.flatMap((s,i)=>[320,360,432].flatMap(w=>['square','auto'].map(z=>({i,w,z}))))],job=running?matrix[results.length]:null
 useEffect(()=>{if(job){setIndex(job.i);setWidth(job.w);setSize(job.z)}else if(running)setRunning(false)},[results.length,running,samples.length])
 const resources=useMemo(()=>{if(!sample)return {};if(sample.resources)return sample.resources;try{return Object.fromEntries(collectImages(sample.spec).map(j=>[j.key,{status:'error'}]))}catch{return {}}},[sample])
 const transport=useMemo(()=>async p=>p.tool==='glm.generate'?{kind:p.target.startsWith('slot:')?'slot':'page',spec:compileCard(p.target.startsWith('slot:')?TOOL_SLOT:TOOL_PAGE,{final:true,cardId:'qa-child-'+crypto.randomUUID()}).spec,resources:{}}:{kind:'json',value:sample?.toolValues?.[p.tool]||{items:[],source:'SYNTHETIC QA',fetchedAt:'2026-10-15T00:00:00Z'}},[sample])
 useEffect(()=>{
  if(!running||!sample||!job||index!==job.i||width!==job.w||size!==job.z)return
  const key=sample.blindId+'-'+width+'-'+size;if(recorded.current===key)return
  const timer=setTimeout(()=>{const root=box.current,stage=root?.querySelector('.cs-stage');if(!stage)return
   const bounds=stage.getBoundingClientRect(),escaping=[...root.querySelectorAll('.cs-card *')].filter(el=>{
    if(el.closest('dialog:not([open]),.cs-diagram-measure,[aria-hidden="true"]'))return false
    const r=el.getBoundingClientRect();if(!r.width||!r.height)return false
    let a=el.parentElement;while(a&&a!==stage){if(/auto|scroll|hidden|clip/.test(getComputedStyle(a).overflowX))return false;a=a.parentElement}
    return r.left<bounds.left-2||r.right>bounds.right+2
   }).map(e=>e.tagName+':'+e.textContent.slice(0,45)).slice(0,8)
   recorded.current=key;setResults(r=>[...r,{blindId:sample.blindId,width,size,outerOverflow:stage.scrollWidth>stage.clientWidth+2,escaping,errors:[...root.querySelectorAll('[data-cs-error],.cs-node-failure')].map(e=>e.textContent),textCharacters:(root.querySelector('.cs-card')?.innerText||'').length,measured:measureExperience(stage),visuals:[...root.querySelectorAll('.cs-chart,.cs-diagram,.cs-mermaid,.cs-image')].length}])
  },350);return()=>clearTimeout(timer)
 },[sample,index,width,size,running,results.length])
 return <main style={{fontFamily:'system-ui',padding:16}}><h1>体验规划对照验收</h1><p>匿名样本；模拟图片失败和固定工具替身，不访问 OpenCLI。几何检查不替代人工内容评价。</p><button disabled={!samples.length||running} onClick={()=>{recorded.current='';setResults([]);setRunning(true)}}>运行全部尺寸检查</button><button onClick={()=>setRunning(false)}>停止</button><output aria-label="进度">{running?'运行中':'已停止'} {results.length}/{matrix.length}</output><label>样本<select aria-label="样本" value={index} onChange={e=>setIndex(Number(e.target.value))}>{samples.map((s,i)=><option key={s.blindId} value={i}>{s.blindId} · {s.prompt}</option>)}</select></label><label>宽度<select aria-label="宽度" value={width} onChange={e=>setWidth(Number(e.target.value))}>{[320,360,432].map(n=><option key={n}>{n}</option>)}</select></label><label>尺寸<select aria-label="尺寸" value={size} onChange={e=>setSize(e.target.value)}><option value="square">方形</option><option value="auto">高度不限</option></select></label>
 <style>{'select{max-width:100%}label{display:inline-block;margin:6px}button{margin:4px}output{margin:8px}'}</style><div ref={box} style={{width,maxWidth:'100%',margin:'20px auto'}}><CardSizeOverride.Provider value={size}>{sample&&<CardRenderer key={sample.blindId+'-'+width+'-'+size} spec={sample.spec} resources={resources} transport={transport} toolsReady={true} persistenceKey={sample.blindId==='session-proof'?'experience-qa-session':undefined}/>}</CardSizeOverride.Provider></div><details><summary>检查结果 JSON</summary><pre data-testid="qa-results" style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(results)}</pre></details></main>
}
createRoot(document.getElementById('root')).render(<Qa/> )
