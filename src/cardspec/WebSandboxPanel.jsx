import React,{useEffect,useMemo,useRef,useState} from 'react'
import {useSandboxMode} from '../SandboxMode.jsx'
import {useMotionPreference} from '../MotionControl.jsx'
import {useViewState} from './view-state.jsx'
import {readDesignEnvironment} from './design-environment.js'
import {webDocument} from './web-document.mjs'
import {validateSandboxState} from '../../shared/cardspec/sandbox-policy.mjs'
import {sandboxActions,validateSandboxEffects} from '../../shared/cardspec/sandbox-bridge.mjs'
import {executeAction} from '../../shared/cardspec/store.mjs'

export function WebSandboxPanel({p,nodeId,runtime,children}){
 const mode=useSandboxMode(),motion=useMotionPreference(),allowed=mode==='web'&&runtime.spec.context?.renderMode==='web'
 const module=runtime.spec.sandboxModules?.[nodeId]
 const [saved,save]=useViewState('webSandbox',null),[active,setActive]=useState(false),[activated,setActivated]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[request,setRequest]=useState(null)
 const [visualIssue,setVisualIssue]=useState('')
 const root=useRef(null),frame=useRef(null),current=useRef(null),savedRef=useRef(saved)
 savedRef.current=saved
 const actions=sandboxActions(p.actions||{},runtime.spec),actionKey=JSON.stringify(actions),inputKey=JSON.stringify(p.input||{})
 current.current={runtime,actions,active,allowed,p,save,motion}
 const token=useMemo(()=>crypto.randomUUID(),[module?.id,retry])
 const html=useMemo(()=>module?.kind==='web'?webDocument(module,token):'',[module?.id,token])
 const post=value=>frame.current?.contentWindow?.postMessage({web:token,...value},'*')
 const initialize=()=>{const c=current.current;post({type:'init',state:savedRef.current?.module===module?.id?savedRef.current.state:c.p.initial||{},data:c.p.input||{},actions:Object.keys(c.actions),active:c.active})}
 const environment=()=>{const c=current.current;post({type:'environment',data:c.p.input||{},active:c.active,reducedMotion:c.motion!=='full',theme:root.current?readDesignEnvironment(root.current):{}})}
 useEffect(()=>{let intersecting=false;const update=()=>{const visible=intersecting&&!document.hidden;setActive(visible);if(visible)setActivated(true)};const o=new IntersectionObserver(([e])=>{intersecting=e.isIntersecting;update()});o.observe(root.current);document.addEventListener('visibilitychange',update);return()=>{o.disconnect();document.removeEventListener('visibilitychange',update)}},[])
 useEffect(()=>{setReady(false);setError('');setRequest(null);setVisualIssue('')},[token,allowed])
 useEffect(()=>{environment()},[inputKey,active,motion,ready])
 useEffect(()=>{
  if(!allowed||!activated||!module||ready||error)return
  const timer=setTimeout(()=>setError('Web 应用启动超时；CDN 可能不可用，可重试。'),20000)
  return()=>clearTimeout(timer)
 },[allowed,activated,module?.id,ready,error,retry])
 useEffect(()=>{
  const receive=e=>{
   if(e.source!==frame.current?.contentWindow||e.data?.web!==token)return
   const d=e.data,ctx=current.current
   if(!ctx.allowed)return
   if(d.type==='boot'){initialize();environment()}
   else if(d.type==='ready'){setReady(true);environment()}
   else if(d.type==='visuals')setVisualIssue(d.detail?.issues?.[0]?.code==='visual-zero-size'?String(d.detail.issues[0].message).slice(0,300):'')
   else if(d.type==='state')try{validateSandboxState(d.value);if(JSON.stringify(d.value).length>65536)throw Error('状态过大');ctx.save({module:module.id,state:d.value})}catch(e){setError(e.message)}
   else if(d.type==='error')setError(String(d.message||'Web 应用出错').slice(0,1000))
   else if(d.type==='action'&&ctx.active&&!ctx.runtime.streaming){
    try{validateSandboxEffects([{type:'action',name:d.name,payload:d.payload}]);if(!Object.hasOwn(ctx.actions,d.name))throw Error('未开放此宿主操作');setRequest(old=>old||{name:d.name,payload:structuredClone(d.payload)})}catch(e){setError(e.message)}
   }
  }
  window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)
 },[token,module?.id,actionKey])
 function confirm(){
  const ctx=current.current
  if(!request||!ctx.allowed||!ctx.active||ctx.runtime.streaming)return
  try{const action=ctx.actions[request.name];if(!action)throw Error('操作已失效');const extra={event:request.payload,args:request.payload};if(ctx.runtime.fire)ctx.runtime.fire(action,extra);else executeAction(ctx.runtime.spec,ctx.runtime.store,action,extra);ctx.runtime.notify();setRequest(null)}catch(e){setError(e.message)}
 }
 return <section ref={root} className="cs-sandbox cs-web-sandbox" data-cs-node={nodeId} data-cs-component="sandbox" data-sandbox-ready={ready&&!error?'true':'false'} aria-label={p.label||'Web 应用'}>
  {allowed&&activated&&html&&!error&&<iframe ref={frame} title={p.label||'Web 应用'} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={html} onLoad={()=>{initialize();environment()}} style={{width:'100%',height:p.height||420,border:0,background:'transparent',display:'block'}}/>}
  {!allowed&&<span role="status">此应用需要“完整 Web · React / CDN”模式；严格沙箱模式下不会执行，请切换或重新生成严格版本。</span>}
  {allowed&&!ready&&!error&&<span role="status">正在启动 Web 应用…</span>}
  {allowed&&ready&&!error&&visualIssue&&<span role="status" data-visual-warning="zero-size" title={visualIssue}>图形区域未正常显示，其他控件仍可使用。</span>}
  {error&&<div role="alert">Web 应用暂不可用：{error}<button type="button" onClick={()=>setRetry(v=>v+1)}>重新启动</button></div>}
  {request&&allowed&&<div role="group" aria-label="确认 Web 应用操作"><span>应用请求执行：{request.name}</span><button type="button" onClick={confirm}>允许这次操作</button><button type="button" onClick={()=>setRequest(null)}>取消</button></div>}
  {(!allowed||error)&&children}
 </section>
}
