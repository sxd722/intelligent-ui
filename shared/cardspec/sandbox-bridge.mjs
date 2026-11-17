import {logicJson} from './logic-contract.mjs'
const name=/^[A-Za-z][\w-]{0,63}$/
export function sandboxActions(value={},spec){
 logicJson(value,{record:true})
 const entries=Object.entries(value)
 if(entries.length>8)throw Error('sandbox supports at most eight named actions')
 for(const [alias,action]of entries)if(!name.test(alias)||typeof action!=='string'||!name.test(action)||spec&&!Object.hasOwn(spec.actions,action))throw Error('Invalid sandbox action mapping: '+alias)
 return value
}
export function validateSandboxEffects(effects=[]){
 if(!Array.isArray(effects)||effects.length>1)throw Error('Use one host action per gesture; combine steps in CardSpec')
 for(const e of effects){
  if(!e||e.type!=='action'||!name.test(e.name)||Object.keys(e).some(k=>!['type','name','payload'].includes(k)))throw Error('Invalid sandbox bridge effect')
  if(logicJson(e.payload,{record:true}).length>4096)throw Error('Sandbox bridge payload too large')
 }
 return effects
}
// Lifecycle denials are not model/runtime failures. Check before running an
// event and again before committing effects (the page may change meanwhile).
export function sandboxInteractionBlock({active,trusted,streaming=false,current=true}){
 if(!current)return {code:'sandbox_page_stale',message:'页面已切换，本次操作未执行。'}
 if(streaming)return {code:'sandbox_preview',message:'当前为生成预览，完成后可交互。'}
 if(!active)return {code:'sandbox_inactive',message:'视图暂未激活，请返回视图后重试。'}
 if(!trusted)return {code:'sandbox_untrusted_event',message:'本次操作未执行，请直接点击或使用键盘操作。'}
 return null
}
export function isSandboxInteractionBlocked(error){return error?.name==='SandboxInteractionBlocked'}
export function dispatchSandboxEffects(effects,{actions,spec,fire,...context}){
 validateSandboxEffects(effects)
 if(!effects.length)return
 const block=sandboxInteractionBlock(context)
 if(block)throw Object.assign(new Error(block.message),{name:'SandboxInteractionBlocked',code:block.code})
 sandboxActions(actions,spec)
 // Validate the whole buffer before invoking the existing transactional action.
 for(const e of effects)if(!Object.hasOwn(actions,e.name))throw Error('Sandbox action is not exposed: '+e.name)
 for(const e of effects)fire(actions[e.name],{event:structuredClone(e.payload),args:structuredClone(e.payload)})
}
