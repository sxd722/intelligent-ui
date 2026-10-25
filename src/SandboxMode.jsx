import React,{createContext,useContext,useSyncExternalStore} from 'react'
import {sandboxMode} from '../shared/cardspec/sandbox-policy.mjs'
const KEY='cardspec:render-mode:v1',listeners=new Set();let mode='native',permitted=false,status='loading'
try{mode=sandboxMode(localStorage.getItem(KEY))}catch{}
const notify=()=>listeners.forEach(fn=>fn())
// Fail closed, including restored hybrid cards. Server policy overrides preference.
export async function refreshSandboxCapability(){
 status='loading';notify()
 try{const r=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('health unavailable');const v=await r.json();if(typeof v.cardSandbox!=='boolean')throw Error('missing capability');permitted=v.cardSandbox;status=permitted?'enabled':'disabled'}
 catch{permitted=false;status='error'}finally{notify()}
}
if(typeof window!=='undefined')refreshSandboxCapability()
if(typeof window!=='undefined')window.addEventListener('storage',e=>{if(e.key===KEY){mode=sandboxMode(e.newValue);notify()}})
export const SandboxSettings=createContext(null)
export function useSandboxMode(){const override=useContext(SandboxSettings);useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>status+':'+mode,()=> 'loading:native');return permitted?sandboxMode(override||mode):'native'}
export function SandboxModeControl(){const value=useSandboxMode(),message=status==='error'?'无法读取宿主能力，可重试':status==='loading'?'正在读取宿主能力':status==='disabled'?'当前宿主明确禁用 Web 内容':'React / SVG 可用；原生组件优先，特殊视觉才使用无网络沙箱';return <span className="chip sandbox-mode-control"><label>React / SVG 沙箱 <select aria-label="UI能力" value={value} disabled={!permitted} title={message} onChange={e=>{mode=sandboxMode(e.target.value);try{localStorage.setItem(KEY,mode)}catch{}notify()}}><option value="native">关闭 · 纯 CardSpec</option><option value="hybrid">开启 · React / SVG</option></select></label>{status==='error'?<button type="button" onClick={refreshSandboxCapability}>重试能力检测</button>:status!=='enabled'?<small role="status">{message}</small>:null}</span>}
