// Host-provided persistent JSON state is an atomic transaction. Give updater
// functions a private draft so returning a mutated draft cannot silently hit
// React's identity bailout or damage the previous committed snapshot.
function serialize(value){
 const raw=JSON.stringify(value,(_key,item)=>{
  if(typeof item==='number'&&!Number.isFinite(item)||['function','symbol','bigint','undefined'].includes(typeof item))throw Error('Persistent state must contain finite JSON values')
  return item
 })
 if(!raw||raw.length>65536)throw Error('Persistent state exceeds 64 KiB; keep transient data in local React state')
 return raw
}
export function applyWebStateUpdate(previous,update){
 const before=serialize(previous),draft=JSON.parse(before)
 const value=typeof update==='function'?update(draft):update
 const after=serialize(value)
 return before===after?previous:JSON.parse(after)
}
