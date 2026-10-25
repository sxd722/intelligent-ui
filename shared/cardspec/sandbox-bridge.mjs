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
export function dispatchSandboxEffects(effects,{actions,spec,fire,active,trusted}){
 validateSandboxEffects(effects)
 if(!effects.length)return
 if(!active||!trusted)throw Error('Sandbox bridge requires a current user gesture')
 sandboxActions(actions,spec)
 // Validate the whole buffer before invoking the existing transactional action.
 for(const e of effects)if(!Object.hasOwn(actions,e.name))throw Error('Sandbox action is not exposed: '+e.name)
 for(const e of effects)fire(actions[e.name],{event:structuredClone(e.payload),args:structuredClone(e.payload)})
}
