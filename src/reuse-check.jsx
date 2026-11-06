import React from 'react'
import {createRoot} from 'react-dom/client'
import {CardRenderer} from './cardspec/Renderer.jsx'
import {CardSizeOverride} from './CardSize.jsx'
import {MapEnvironment} from './cardspec/MapEnvironment.jsx'
import {SandboxSettings} from './SandboxMode.jsx'
import {createDebugTransport} from '../shared/cardspec/debug-fixtures.mjs'
import {debugControls} from './cardspec/debug-controls.mjs'
import {auditLayout} from './cardspec/layout-audit.js'
import {collectImages} from '../shared/cardspec/images.mjs'
import {canonicalInput} from '../shared/cardspec/prefetch.mjs'
import './styles/tokens.css'
import './styles/dil.css'
import './styles/themes.css'
// No billable image generation or live tool execution in validation, including
// image queries that only appear after a selection changes.
const originalFetch=window.fetch.bind(window)
window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/'))return Promise.resolve(Response.json({status:'error',error:'Validation uses isolated resources'},{status:503}));return originalFetch(input,init)}
const root=createRoot(document.getElementById('root')),prefix='reuse-check:'+crypto.randomUUID()
let session,sequence=0,aborted=false
const pause=ms=>new Promise(r=>setTimeout(r,ms))
const check=()=>{if(aborted)throw Error('已取消验证')}
async function settle(){await pause(250);for(let i=0;i<80;i++){check();if(session&&!document.querySelector('.cs-sandbox:not([data-sandbox-ready="true"])'))break;await pause(100)}await new Promise(requestAnimationFrame);if(document.querySelector('.cs-sandbox:not([data-sandbox-ready="true"])'))throw Error('沙箱未就绪，未提交同款')}
function snapshot(){
 const stage=document.querySelector('.cs-stage'),page=session?.current()
 const errors=[...document.querySelectorAll('.cs-recovery,.cs-node-recovery,.cs-action-error,[data-cs-error],.cs-logic-error,.cs-sandbox [role=alert]')].map(e=>e.textContent.trim()).filter(Boolean)
 const layout=stage?auditLayout(stage):{issues:[]}
 const fatal=layout.issues.filter(i=>['clipped-content','control-occluded','control-not-fully-visible'].includes(i.code))
 if(!stage||!page||errors.length||fatal.length||stage.scrollWidth>stage.clientWidth+2)throw Error('隔离预览未通过：'+(errors[0]||fatal[0]?.code||'空卡片或横向溢出'))
 return {text:stage.innerText.slice(0,6000),state:structuredClone(page.store.values),components:structuredClone(page.viewState.components||{}),layout:layout.issues,controls:debugControls(stage)}
}
const feedback=s=>JSON.stringify([s.state,s.components,s.text])
async function mount(spec,width,key,restore=false){
 check();root.render(null);await pause(30);session=null
 document.body.style.cssText=`margin:0;padding:0;width:${width}px;background:transparent`
 const copy=structuredClone(spec),resources=Object.fromEntries(collectImages(copy).map(j=>[j.key,{status:'error'}]))
 copy.cardId='reuse-isolated'; const mock=createDebugTransport()
 const transport=async(p,signal)=>{
  const cached=(copy.prefetched||[]).find(x=>x.tool===p.tool&&canonicalInput(x.input)===canonicalInput(p.input))
  return cached?{kind:'json',value:structuredClone(cached.value)}:mock(p,signal)
 }
 if(!restore)sessionStorage.removeItem(key)
 root.render(<MapEnvironment.Provider value="offline"><SandboxSettings.Provider value={copy.context?.renderMode||'native'}><CardSizeOverride.Provider value={copy.context?.cardSize||'square'}><CardRenderer key={++sequence} spec={copy} resources={resources} persistenceKey={key} transport={transport} onDebugSession={s=>{session=s}} debugAuthorizeWrite={()=>{throw Error('验证不执行外部写操作')}}/></CardSizeOverride.Provider></SandboxSettings.Provider></MapEnvironment.Provider>)
 await settle();return snapshot()
}
function act(c){
 const el=[...document.querySelectorAll('[data-debug-handle]')].find(e=>e.getAttribute('data-debug-handle')===c.handle)
 if(!el||el.disabled)throw Error('关键控件缺失或不可操作：'+c.name)
 if(el.tagName==='INPUT'&&!['checkbox','radio','button','submit'].includes(el.type)||el.tagName==='TEXTAREA'){
  let value
  if(el.type==='range'||el.type==='number'){const step=Number(el.step)||1,max=el.max===''?100:Number(el.max),min=el.min===''?0:Number(el.min);value=Number(el.value)+step<=max?Number(el.value)+step:min}
  else if(el.type==='date')value='2026-11-02'
  else value='test'
  const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))
 }else if(el.tagName==='SELECT'){
  const option=[...el.options].find(o=>!o.disabled&&o.value!==el.value);if(!option)return
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,option.value);el.dispatchEvent(new Event('change',{bubbles:true}))
 }else el.click()
}
window.reuseCheck={
 cancel(){aborted=true;root.render(null);for(const k of Object.keys(sessionStorage))if(k.startsWith(prefix))sessionStorage.removeItem(k)},
 async run(spec,width,expected){
  aborted=false;const key=prefix+':'+width,first=await mount(spec,width,key),controls=expected?.actions||first.controls.filter(c=>!c.disabled&&c.role!=='a').slice(0,8),actions=[]
  try{
   for(const c of controls){check();const before=snapshot();if(!before.controls.some(x=>x.handle===c.handle)){if(expected)throw Error('内容替换后关键控件不可达：'+c.name);continue}
    act(c);await settle();const after=snapshot(),changed=feedback(before)!==feedback(after)
    if(expected&&c.changed&&!changed)throw Error('内容替换后交互没有反馈：'+c.name)
    actions.push({handle:c.handle,name:c.name,changed})
   }
   const before=snapshot();session.save();const restored=await mount(spec,width,key,true)
   if(JSON.stringify(before.state)!==JSON.stringify(restored.state)||JSON.stringify(before.components)!==JSON.stringify(restored.components))throw Error('状态恢复检查失败')
   return {width,actions,restored:true,status:'passed',layoutWarnings:restored.layout,coverage:'最多8个首屏原生控件；隔离工具回放，不覆盖所有业务分支或沙箱内部控件'}
  }finally{root.render(null);await pause(30);sessionStorage.removeItem(key)}
 }
}
