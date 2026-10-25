import {useMotionPreference} from '../MotionControl.jsx'
import React,{useEffect,useRef,useState,useMemo} from 'react'
import {useViewState} from './view-state.jsx'
import {createSandboxClient} from './sandbox-client.js'
import {sandboxDocument} from './sandbox-document.mjs'
import {validateSandboxTree,validateSandboxState} from '../../shared/cardspec/sandbox-policy.mjs'
import {logicJson} from '../../shared/cardspec/logic-contract.mjs'
import {useSandboxMode} from '../SandboxMode.jsx'
import {sandboxActions,dispatchSandboxEffects,validateSandboxEffects} from '../../shared/cardspec/sandbox-bridge.mjs'
import {executeAction} from '../../shared/cardspec/store.mjs'
import {readDesignEnvironment} from './design-environment.js'
export function SandboxPanel({p,nodeId,runtime,children}){
 const motionLevel=useMotionPreference()
 const mode=useSandboxMode(),[paused,setPaused]=useState(false)
 const [saved,save]=useViewState('sandbox',null),[visible,setVisible]=useState(false),[error,setError]=useState(''),[native,setNative]=useState(false),[retry,setRetry]=useState(0),[frameReady,setFrameReady]=useState(false)
 const root=useRef(null),frame=useRef(null),client=useRef(null),latest=useRef(null),saveRef=useRef(save),savedRef=useRef(saved),eventPending=useRef(false)
 saveRef.current=save;savedRef.current=saved
 const actions=sandboxActions(p.actions||{},runtime.spec),actionKey=JSON.stringify(actions)
 const inputKey=logicJson(p.input||{}),definitionKey=p.source?JSON.stringify([p.source,actions]):Object.keys(actions).length?JSON.stringify([p.brief,actions]):JSON.stringify([p.brief]),allowed=mode==='hybrid'&&runtime.spec.context?.renderMode==='hybrid'
 const inputRef=useRef(inputKey);inputRef.current=inputKey
 const context=useRef(null);context.current={runtime,actions,allowed,visible,native}
 const module=runtime.spec.sandboxModules?.[nodeId]||(saved?.definitionKey===definitionKey?saved.module:null)
 const hasFallback=React.Children.toArray(children).some(Boolean)
 const token=useMemo(()=>crypto.randomUUID(),[module?.id]),document=useMemo(()=>{try{return {html:module?sandboxDocument(module.css,token):''}}catch(e){return {html:'',error:e.message}}},[module?.id,token])
 const post=()=>{if(latest.current&&frame.current)frame.current.contentWindow?.postMessage({sandbox:token,type:'render',...latest.current},'*')}
 const environment=()=>{if(!root.current||!frame.current)return;frame.current.contentWindow?.postMessage({sandbox:token,type:'environment',theme:readDesignEnvironment(root.current),motionLevel,active:visible&&!paused&&motionLevel==='full'},'*')}
 useEffect(environment,[visible,paused,frameReady,p,motionLevel])
 useEffect(()=>{let intersecting=false;const update=()=>setVisible(intersecting&&!window.document.hidden);const observer=new IntersectionObserver(([e])=>{intersecting=e.isIntersecting;update()});observer.observe(root.current);window.document.addEventListener('visibilitychange',update);return()=>{observer.disconnect();window.document.removeEventListener('visibilitychange',update)}},[])
 useEffect(()=>{setError('')},[definitionKey,retry])
 useEffect(()=>{
  if(!allowed||native||!visible||!module||document.error)return
  setFrameReady(false)
  const c=createSandboxClient();client.current=c;let alive=true
  const apply=result=>{if(!alive)return;validateSandboxTree(result.tree);validateSandboxState(result.state);latest.current=result;saveRef.current({...savedRef.current,definitionKey,state:result.state,status:'ready',error:null});post()}
  c.apply=apply;c.pageId=runtime.page.id;c.initialized=false
  c.request('init',{code:module.code,input:JSON.parse(inputKey),state:(savedRef.current?.definitionKey===definitionKey?savedRef.current.state:null)||p.initial||{},capabilities:Object.keys(actions)}).then(async result=>{
   if(!alive)return
   c.initialized=true
   // Cold WASM startup has its own deadline. Do not start a short input timer
   // while init is still loading; coalesce parent changes to the latest input.
   apply(inputRef.current===inputKey?result:await c.request('input',JSON.parse(inputRef.current)))
  }).catch(e=>{if(alive){setError(e.message);c.close()}})
  return()=>{alive=false;c.close();if(client.current===c)client.current=null;latest.current=null}
 },[allowed,native,visible,module?.id,token,retry,actionKey])
 useEffect(()=>{if(!allowed||native||!visible||!module||frameReady||error)return;const timer=setTimeout(()=>setError('交互视图启动超时'),10000);return()=>clearTimeout(timer)},[allowed,native,visible,module?.id,frameReady,error,retry])
 useEffect(()=>{const c=client.current;if(c?.initialized)c.request('input',JSON.parse(inputKey)).then(c.apply).catch(e=>{if(client.current===c)setError(e.message)})},[inputKey])
 useEffect(()=>{const receive=e=>{
  if(e.source!==frame.current?.contentWindow||e.data?.sandbox!==token)return
  if(e.data.type==='ready'){post();environment();return}
  if(e.data.type==='rendered'){if(e.data.revision===latest.current?.revision)setFrameReady(true);return}
  if(e.data.type==='error'){setError(e.data.message);return}
  if(e.data.type==='layout'){
   // Trusted iframe reports its opaque DOM; cap evidence before persisting it.
   const d=e.data.detail
   if(d&&Array.isArray(d.containers)&&Array.isArray(d.controls)&&Array.isArray(d.issues)&&JSON.stringify(d).length<60000){
    root.current.dataset.layoutAudit=JSON.stringify(d)
    root.current.dispatchEvent(new CustomEvent('cardspec-sandbox-layout',{bubbles:true}))
   }
   return
  }
  if(e.data.type!=='event'||!visible||eventPending.current||e.data.revision!==latest.current?.revision||!client.current)return
  const c=client.current;eventPending.current=true;c.request('event',e.data.event,e.data.handler).then(result=>{
   if(client.current!==c)return
   const ctx=context.current
   validateSandboxTree(result.tree);validateSandboxState(result.state);validateSandboxEffects(result.effects)
   dispatchSandboxEffects(result.effects,{actions:ctx.actions,spec:ctx.runtime.spec,active:ctx.allowed&&ctx.visible&&!ctx.native&&!ctx.runtime.streaming&&c.pageId===ctx.runtime.page.id,trusted:e.data.event?.trusted===true,
    fire:(action,extra)=>{if(ctx.runtime.fire)ctx.runtime.fire(action,extra);else executeAction(ctx.runtime.spec,ctx.runtime.store,action,extra);ctx.runtime.notify()}})
   c.apply(result)
  }).catch(e=>{if(client.current===c){setError(e.message);c.close()}}).finally(()=>{eventPending.current=false})
 };window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[token,visible])
 const failure=error||document.error||(!runtime.streaming&&allowed&&!module?'此旧卡片没有预编译的交互视图；请重新生成整张卡片。':'')
 const enhanced=allowed&&module&&!native&&!failure
 useEffect(()=>{
  if((!enhanced||!frameReady)&&root.current?.dataset.layoutAudit){
   delete root.current.dataset.layoutAudit
   root.current.dispatchEvent(new CustomEvent('cardspec-sandbox-layout',{bubbles:true}))
  }
 },[enhanced,frameReady])
 return <section ref={root} className="cs-sandbox" data-cs-component="sandbox" aria-label={p.label||'交互视图'}>
  {enhanced&&<iframe title={p.label||'交互视图'} sandbox="allow-scripts" referrerPolicy="no-referrer" ref={frame} srcDoc={document.html} onLoad={()=>{post();environment()}} style={{display:frameReady?'block':'none',width:'100%',height:p.height||320,border:0,background:'transparent'}}/>}
  {(!enhanced||!frameReady)&&children}
  {!allowed&&!hasFallback&&<span role="status">此区域使用 React / SVG，请开启沙箱查看；纯 CardSpec 模式可重新生成原生版本。</span>}
  {allowed&&<div className="cs-row" style={{flexWrap:'wrap',gap:8}}>
   {enhanced&&!frameReady&&<span role="status">正在启动增强视图…</span>}
   {failure&&<span role="alert">交互视图暂不可用。{failure}</span>}
   {failure&&module&&<button type="button" className="cs-button" onClick={()=>{setError('');setRetry(x=>x+1)}}>重新启动视图</button>}
   {module&&<details className="cs-sandbox-options"><summary aria-label="视图选项">⋯</summary>{hasFallback&&<button type="button" className="cs-button" onClick={()=>setNative(x=>!x)}>{native?'增强视图':'原生视图'}</button>}{module.animated&&<button type="button" className="cs-button" onClick={()=>setPaused(x=>!x)}>{paused?'播放动效':'暂停动效'}</button>}</details>}
  </div>}
 </section>
}
