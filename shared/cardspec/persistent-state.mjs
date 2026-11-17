import {logicJson} from './logic-contract.mjs'

// Only explicitly named undo/history queues are disposable. Never trim board,
// items, records, selections or other application data to make a snapshot fit.
export const FIFO_STATE_QUEUES=['history','undoStack','actionHistory']
export function fitPersistentState(value){
 let visited=0
 const raw=JSON.stringify(value,(key,item)=>{
  if(++visited>100000)throw Error('状态过大，无法安全保存')
  if(['__proto__','constructor','prototype'].includes(key))throw Error('逻辑数据含保留字段')
  if(typeof item==='number'&&!Number.isFinite(item)||['function','symbol','bigint','undefined'].includes(typeof item))throw Error('Persistent state must contain finite JSON values')
  if(item&&typeof item==='object'&&!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)throw Error('Persistent state must contain plain JSON values')
  return item
 })
 if(!raw||raw.length>4*1024*1024)throw Error('状态过大，无法安全保存')
 const state=JSON.parse(raw),removed={}
 const fits=()=>{try{logicJson(state,{record:true});return true}catch(e){if(e.code!=='STATE_CAPACITY')throw e;return false}}
 if(fits())return {state,removed,totalRemoved:0}
 const queues=FIFO_STATE_QUEUES.filter(k=>Array.isArray(state[k])&&state[k].length).sort((a,b)=>JSON.stringify(state[b]).length-JSON.stringify(state[a]).length)
 for(const key of queues){
  const queue=state[key]
  state[key]=[]
  if(!fits()){removed[key]=queue.length;continue}
  // Find the smallest FIFO prefix removal that satisfies every state budget.
  let low=1,high=queue.length
  while(low<high){const mid=Math.floor((low+high)/2);state[key]=queue.slice(mid);if(fits())high=mid;else low=mid+1}
  state[key]=queue.slice(low);removed[key]=low
  return {state,removed,totalRemoved:Object.values(removed).reduce((a,b)=>a+b,0)}
 }
 throw Error('当前状态超出保存容量，已保留上次有效状态；不会删除业务数据')
}
