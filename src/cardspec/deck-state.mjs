import {checkValue} from '../../shared/cardspec/registry.mjs'
const copy=x=>structuredClone(x)
// One coordinator per conversation deck. Explicit declarations only; same-name
// local fields and unrelated cards never share implicitly.
export function createDeckState({storage,key}={}){
 let fields=Object.create(null);const listeners=new Set()
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved?.version===1)fields=saved.fields||fields}catch{}
 const persist=()=>{try{storage?.setItem(key,JSON.stringify({version:1,fields}))}catch{}}
 function hydrate(page){
  for(const [id,d]of Object.entries(page.spec.state||{}))if(d.scope==='deck'){
   if(!Object.hasOwn(fields,id))fields[id]={type:d.type,value:copy(page.store.values[id])}
   const f=fields[id]
   if(f.type!==d.type||!checkValue(d.type,f.value))throw Error(`Shared state ${id} type mismatch`)
   page.store.values[id]=copy(f.value)
  }
 }
 return {
  hydrate,
  publish(page,before){
   const changed=[]
   for(const [id,d]of Object.entries(page.spec.state||{}))if(d.scope==='deck'&&JSON.stringify(before[id])!==JSON.stringify(page.store.values[id])){
    if(fields[id]?.type!==d.type||!checkValue(d.type,page.store.values[id]))throw Error(`Shared state ${id} type mismatch`)
    changed.push([id,{type:d.type,value:copy(page.store.values[id])}])
   }
   if(!changed.length)return
   for(const [id,value]of changed)fields[id]=value
   persist();for(const fn of listeners)fn()
  },
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
  save:persist,snapshot:()=>copy(fields)
 }
}
