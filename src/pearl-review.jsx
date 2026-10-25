import React,{useEffect,useMemo,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from './cardspec/Renderer.jsx'
import {CardSizeOverride} from './CardSize.jsx'
import {SandboxSettings} from './SandboxMode.jsx'
import {MotionControl} from './MotionControl.jsx'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {KINETIC_FIXTURES} from '../shared/cardspec/kinetic-fixtures.mjs'
import {newPage} from './cardspec/tool-session.mjs'
import module from '../shared/cardspec/pearl-reference.generated.mjs'
import './styles/tokens.css'
import './styles/themes.css'
import './pearl-review.css'
const brief='Pearl 整卡构图确定性参考；共享储能与保存状态，纯示意。',actions={adjust:'adjust',save:'save'},key='cardspec:pearl-reference:v1'
function source(height){return `<card><state id="charge" type="number" initial={40}/><state id="saved" type="number" initial={-1}/><sandbox id="pearl" height={${height}} label="Pearl 整卡样板" brief="${brief}" input={{charge:state.charge,saved:state.saved&lt;0?null:state.saved}} actions={{adjust:"adjust",save:"save"}}><title>能量，流向哪里？</title><stat label="已储能" value={state.charge} unit="%"/><text>剩余 {100-state.charge}%</text><slider label="储能比例" min={0} max={100} unit="%" value={state.charge} onChange="adjust"/><button onPress="save">保存当前方案</button><text>{state.saved&lt;0?"尚未保存":"已保存 "+state.saved+"%"}</text></sandbox><action id="adjust"><set target="charge" value={clamp(event.value,0,100)}/></action><action id="save"><set target="saved" value={state.charge}/></action></card>`}
function seed(spec){
 try{const prior=JSON.parse(sessionStorage.getItem(key)||'null');if(prior?.version===1&&prior.rootId===spec.cardId&&prior.pages?.[0]?.viewState?.components?.['/pearl']?.sandbox?.module?.id===module.id)return}catch{}
 const page=newPage(spec);page.viewState.components={'/pearl':{sandbox:{definitionKey:JSON.stringify([brief,actions]),status:'ready',module,state:{}}}}
 sessionStorage.setItem(key,JSON.stringify({version:1,rootId:spec.cardId,index:0,pages:[page],favorites:{},media:{}}))
}
function Review(){
 const [width,setWidth]=useState(432),[size,setSize]=useState('square'),[mode,setMode]=useState('hybrid'),[revision,setRevision]=useState(0),[metrics,setMetrics]=useState({})
 const [viewport,setViewport]=useState(window.innerWidth)
 useEffect(()=>{const resize=()=>setViewport(window.innerWidth);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[])
 const actualWidth=Math.min(width,viewport-(viewport<=380?20:40))
 const height=size==='square'?actualWidth:Math.max(400,actualWidth)
 const spec=useMemo(()=>{const r=compileCard(source(height),{final:true,cardId:'pearl-whole-v1',context:{renderMode:'hybrid'}});if(!r.spec)throw Error(JSON.stringify(r.diagnostics));seed(r.spec);return r.spec},[height,revision])
 const original=useMemo(()=>compileCard(KINETIC_FIXTURES.kineticPearl,{final:true,cardId:'pearl-old-reference'}).spec,[])
 return <main className="pr-review"><header><small>RENDERER STUDY / 01</small><h1>让主视觉回到卡片中央。</h1><p>同一储能任务：旧组件拼接与完整沙箱构图。确定性示例，无模型或工具调用。</p></header>
 <nav><label>宽度 <select aria-label="宽度" value={width} onChange={e=>setWidth(+e.target.value)}>{[320,360,432].map(w=><option key={w}>{w}</option>)}</select></label><label>尺寸 <select aria-label="尺寸" value={size} onChange={e=>setSize(e.target.value)}><option value="square">方形</option><option value="auto">自然高度</option></select></label><label>视图 <select aria-label="视图" value={mode} onChange={e=>setMode(e.target.value)}><option value="hybrid">React 沙箱样板</option><option value="native">原生功能回退</option></select></label><MotionControl/><button onClick={()=>{sessionStorage.removeItem(key);setRevision(v=>v+1)}}>重置样板</button></nav>
 <CardSizeOverride.Provider value={size}><div className="pr-pair" style={{'--pr-width':actualWidth+'px','--pr-height':height+'px'}}>
  <article><h2>01 / 整卡构图候选</h2><SandboxSettings.Provider value={mode}><div className="pearl-reference" data-mode={mode}><CardRenderer key={revision} spec={spec} persistenceKey={key} onLayout={d=>setMetrics(m=>({...m,reference:d}))}/></div></SandboxSettings.Provider><p>珠光形体 · 单一主数值 · 比例条 · 调节 / 保存</p></article>
  <article><h2>00 / 旧 Pearl 对照</h2><div className="pearl-original"><CardRenderer materialPreview="template-v1" spec={original} onLayout={d=>setMetrics(m=>({...m,original:d}))}/></div><p>保留原始实现，观察内层溢出与控件首屏可见性。</p></article>
 </div></CardSizeOverride.Provider>
 <details className="pr-diagnostics"><summary>真实 DOM 布局诊断</summary><pre>{JSON.stringify(metrics,null,2)}</pre></details><p className="pr-note">样板仍为 candidate，尚未替换生成默认模板。Web 关闭时保留完整原生功能。<a href="/design-templates.html?preset=pearl">现有 preset ↗</a></p></main>
}
createRoot(document.getElementById('root')).render(<Review/> )
