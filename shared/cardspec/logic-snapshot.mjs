import {logicJson} from './logic-contract.mjs'

// Experimental H2 channel. No root scope, action, tool or global singleton.
export const logicSnapshotsEnabled=context=>context?.experiment?.logicSnapshots==='readonly-v1'
const version=value=>{
 let a=2166136261,b=2246822507
 for(let i=0;i<value.length;i++){a=Math.imul(a^value.charCodeAt(i),16777619);b=Math.imul(b^value.charCodeAt(i),3266489909)}
 return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`
}
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value)}return value}
export function makeLogicSnapshot(moduleId,source,initial,state,{revision=0,epoch=0,ready=true,error=''}={}){
 const copy=JSON.parse(logicJson(state,{record:true}))
 return freeze({version:1,moduleId,sourceVersion:version(source),initialVersion:version(logicJson(initial,{record:true})),epoch,revision,ready,error:String(error||'').slice(0,240),state:copy})
}
export function createLogicSnapshotBus(){
 const channels=new Map(),listeners=new Map();let epoch=0
 const emit=id=>{for(const fn of listeners.get(id)||[])fn()}
 return {
  read:id=>channels.get(id)?.snapshot||null,
  subscribe(id,fn){let set=listeners.get(id);if(!set){set=new Set();listeners.set(id,set)}set.add(fn);return()=>{set.delete(fn);if(!set.size)listeners.delete(id)}},
  register(moduleId,{source,initial}){
   if(typeof moduleId!=='string'||!moduleId||typeof source!=='string')throw Error('Invalid logic snapshot source')
   logicJson(initial,{record:true})
   const entry={source,initial:JSON.parse(logicJson(initial)),epoch:++epoch,revision:0,key:null,snapshot:null}
   channels.set(moduleId,entry);emit(moduleId)
   return {
    publish(value){
     if(channels.get(moduleId)!==entry)return false
     // Identity comparison uses exact source/initial, never the short display hash.
     if(value.source!==source||value.initialKey!==logicJson(initial,{record:true}))return false
     const key=logicJson({state:value.state,ready:!!value.ready,error:value.error||''})
     if(key===entry.key)return false
     entry.key=key;entry.revision++
     entry.snapshot=makeLogicSnapshot(moduleId,source,initial,value.state,{epoch:entry.epoch,revision:entry.revision,ready:!!value.ready,error:value.error})
     emit(moduleId);return true
    },
    close(){if(channels.get(moduleId)===entry){channels.delete(moduleId);emit(moduleId)}}
   }
  }
 }
}
