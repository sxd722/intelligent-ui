import React from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from '../../src/cardspec/Renderer.jsx'
import {CardSizeOverride} from '../../src/CardSize.jsx'
import {SandboxSettings} from '../../src/SandboxMode.jsx'
import {MapEnvironment} from '../../src/cardspec/MapEnvironment.jsx'
import {makeScope} from '../../shared/cardspec/store.mjs'
import {cases,envelope} from './cases.mjs'
import '../../src/styles/tokens.css'
import '../../src/styles/themes.css'
async function boot(){
const params=new URLSearchParams(location.search),id=params.get('id')||'trip-native',width=Number(params.get('width')||432),size=params.get('size')||'square',r=await fetch('/task-composition-qa/runs/'+id+'.json').then(r=>r.json()),c=cases.find(c=>c.id===r.case)
window.qaCalls=[];window.qaFail=false;window.qaDelay=0
const transport=async(req,signal)=>{
 const entry={tool:req.tool,input:req.input,at:Date.now()};window.qaCalls.push(entry)
 const delay=window.qaDelay;await new Promise(resolve=>setTimeout(resolve,delay))
 if(signal.aborted){entry.cancelled=true;throw Error('cancelled')}
 if(window.qaFail)throw Error('受控来源不可用')
 if(req.tool===c.secondary.tool){const q=req.input.query||req.input.keyword;return {kind:'json',value:envelope(c.id==='trip'?[{shop_id:'food-'+q,name:q+'附近餐厅',rating:4.5,price:60,lat:30.151,lon:120.201,coordSystem:'WGS84'}]:[{bvid:'explain-'+q,title:q+' · 新增解读',description:'来自独立来源的解读资料',play:100}])}}
 if(req.tool===c.tool)return {kind:'json',value:envelope(c.rows)}
 throw Error('UNEXPECTED_TOOL')
}
createRoot(document.getElementById('root')).render(<MapEnvironment.Provider value="offline"><SandboxSettings.Provider value="hybrid"><CardSizeOverride.Provider value={size}><main style={{width,maxWidth:'100%'}}><CardRenderer spec={r.spec} transport={transport} persistenceKey={'composition:'+id} onDebugSession={s=>{window.qaSession=s;window.qaView=()=>{const p=s.current(),scope=makeScope(p.spec,p.store,{bindings:p.bindings});return Object.keys(p.spec.derived).map(k=>scope.derived[k]).find(v=>v?.version===1)}}}/></main></CardSizeOverride.Provider></SandboxSettings.Provider></MapEnvironment.Provider>)

}
boot().catch(e=>{document.getElementById('root').textContent=e.message})

