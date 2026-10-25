import {mkdir,writeFile} from 'node:fs/promises'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchSession} from '../server/research/session.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {WORKBENCH_CASES} from '../shared/workbench-cases.mjs'
const folder=process.argv[2]||'artifacts/cardplan-v2';await mkdir(folder,{recursive:true})
const health=await fetch('http://127.0.0.1:8787/api/health').then(r=>r.json()),key=loadApiKey()
if(!key.ok)throw Error('Model key unavailable')
const round=createModelClient({base:health.upstream,key:key.value,model:health.model}),results=[],queue=[...WORKBENCH_CASES]
await Promise.all(Array.from({length:2},async()=>{while(queue.length){
 const c=queue.shift(),events=[],requests=[]
 const ext=createGenerationTools({goal:c.prompt,enabled:false,allowPlanning:true})
 const session=createResearchSession({extensions:ext,onEvent:e=>events.push(e)})
 await session.run(async(m,o)=>{
  if(o.toolChoice){requests.push({messages:m,temperature:o.temperature,maxTokens:o.maxTokens,tools:o.tools,toolChoice:o.toolChoice});return round(m,o)}
  return {message:{content:'Planning-only evaluation; card generation not executed.'}}
 },[{role:'user',content:c.prompt}],{signal:AbortSignal.timeout(45000)})
 const result={id:c.id,prompt:c.prompt,model:health.model,plan:ext.plan(),events,requests}
 results.push(result);await writeFile(`${folder}/${c.id}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({id:c.id,status:ext.plan()?'planned':'fallback',plan:ext.plan()}))
}}))
await writeFile(`${folder}/plans.json`,JSON.stringify(results,null,2))
console.log(JSON.stringify({planned:results.filter(r=>r.plan).length,total:results.length}))
