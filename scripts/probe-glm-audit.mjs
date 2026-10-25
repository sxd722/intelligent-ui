// Bounded, effect-free state exploration. This is a contract probe, not proof
// that the requested business behavior or external service is correct.
import {readFile,writeFile,readdir} from 'node:fs/promises'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {REGISTRY,checkValue,eventSamples} from '../shared/cardspec/registry.mjs'
import {validateWidget} from '../shared/cardspec/widgets.mjs'
import {createDeltaApplier,isControlEvent} from '../src/delta.js'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
const dir=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'artifacts/glm-audit-2026-10-15'
export function probe(spec,{bindings={}}={}){
 const initial=createStore();makeScope(spec,initial,{bindings})
 const queue=[{store:initial,path:[]}],seen=new Set(),failures=[],effects=[],maxStates=100;let transitions=0
 while(queue.length&&seen.size<maxStates){
  const {store,path}=queue.shift(),key=JSON.stringify(store.values);if(seen.has(key))continue;seen.add(key)
  const scope=makeScope(spec,store,{bindings}),controls=[]
  function walk(nodes,s){for(const n of nodes||[]){try{
   if(n.type==='run'){evaluate(n.value,s);continue}
   if(n.type==='each'){const items=evaluate(n.props.items,s);if(!Array.isArray(items))throw Error('each.items must be array');const keys=new Set();for(const [i,item] of items.entries()){const local={...s,item,index:i,[n.props.as?.value||'item']:item},k=evaluate(n.props.itemKey,local);if(k==null||keys.has(k))throw Error('duplicate/missing each key');keys.add(k);walk(n.children,local)}continue}
   const p=Object.fromEntries(Object.entries(n.props||{}).filter(([k])=>k!=='args').map(([k,v])=>[k,evaluate(v,s)]))
   if(p.visible===false||(n.type==='if'&&!p.test))continue
   for(const [k,v] of Object.entries(p)){const t=REGISTRY[n.type]?.props[k];if(t&&!checkValue(t,v))throw Error(`${n.type}.${k} expected ${t}`)}
   validateWidget(n.type,p)
   if(!p.disabled)for(const [eventName,event] of Object.entries(eventSamples(n.type,p,spec.context))){if(!p[eventName])continue
    const samples=[event]
    if(n.type==='input')samples.push({value:p.inputType==='number'?2:'QA',text:p.inputType==='number'?'2':'QA'})
    if(p.options?.length>1)samples.push({value:p.options[1]?.value??p.options[1]})
    if(p.nodes?.length>1)samples.push({id:p.nodes[1].id,value:p.nodes[1].id})
    for(const e of samples)controls.push({action:p[eventName],node:n.id,extra:{...s,event:e,args:n.props.args?evaluate(n.props.args,{...s,event:e}):{}}})
   }
   walk(n.children,s)
  }catch(e){failures.push({path,node:n.id,type:n.type,error:e.message})}}}
  walk(spec.children,scope)
  if(path.length>=5)continue
  for(const c of controls.slice(0,30)){const next=structuredClone(store),pending=[];try{
   executeAction(spec,next,c.action,{...c.extra,effects:pending});transitions++
   if(pending.length)effects.push({path:[...path,c.action],tools:pending.map(e=>({tool:e.tool,target:e.target,input:e.input}))})
   if(queue.length<400)queue.push({store:next,path:[...path,c.action]})
  }catch(e){failures.push({path:[...path,c.action],node:c.node,error:e.message})}}
 }
 return {states:seen.size,transitions,depthLimit:5,stateLimit:maxStates,truncated:queue.length>0,failures:[...new Map(failures.map(f=>[f.error,f])).values()],effects:effects.slice(0,20),externalCalls:0}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const outputs=[]
for(const file of (await readdir(dir)).filter(f=>f.endsWith('-cardspec.json'))){const r=JSON.parse(await readFile(`${dir}/${file}`,'utf8'));if(r.result.status!=='succeeded')continue;try{outputs.push({id:r.result.id,...probe(r.message.metadata.card_spec)})}catch(e){outputs.push({id:r.result.id,fatal:e.message})}}
const frames=JSON.parse(await readFile(`${dir}/recent-weekend-trace.json`,'utf8').catch(()=> '[]')),envelope={},applier=createDeltaApplier()
for(const {frame} of frames)if(!isControlEvent(frame))applier.apply(envelope,frame)
const recentSpec=envelope.message?.metadata?.card_spec
if(recentSpec){await writeFile(`${dir}/recent-weekend-message.json`,JSON.stringify(envelope.message,null,2));outputs.push({id:'recent-weekend-with-synthetic-rows',...probe(recentSpec,{bindings:{hot:{status:'success',updatedAt:new Date().toISOString(),error:'',value:{items:[{rowKey:'row:a',id:'35322132',title:'示例A',rating:8.5},{rowKey:'row:b',id:'100002',title:'示例B',rating:8}],source:'synthetic QA',fetchedAt:'2026-10-15T00:00:00Z',truncated:false}}}})})}
await writeFile(`${dir}/state-probes.json`,JSON.stringify(outputs,null,2));console.log(JSON.stringify(outputs.map(({id,states,transitions,failures,fatal})=>({id,states,transitions,failures,fatal})),null,2))
}
