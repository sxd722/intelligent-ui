import {mkdir,readFile,writeFile,rename,appendFile} from 'node:fs/promises'
import path from 'node:path'
import {WORKBENCH_CASES,WORKBENCH_RUN} from '../shared/workbench-cases.mjs'
export function createWorkbenchStore(root=path.resolve('artifacts',WORKBENCH_RUN,'feedback')){
 const ids=new Set(WORKBENCH_CASES.map(c=>c.id));let queue=Promise.resolve()
 const valid=id=>{if(!ids.has(id))throw Object.assign(Error('unknown case'),{statusCode:400})}
 const load=async id=>{valid(id);try{return JSON.parse(await readFile(path.join(root,id+'.json'),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
 function enqueue(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result}
 return {
  async all(){return Object.fromEntries((await Promise.all([...ids].map(async id=>[id,await load(id)]))).filter(([,v])=>v))},
  save(id,feedback){valid(id);if(!feedback||typeof feedback!=='object'||Array.isArray(feedback)||JSON.stringify(feedback).length>30000)throw Object.assign(Error('invalid feedback'),{statusCode:400});return enqueue(async()=>{await mkdir(root,{recursive:true});const old=await load(id),record={runId:WORKBENCH_RUN,id,revision:(old?.revision||0)+1,savedAt:new Date().toISOString(),feedback};const file=path.join(root,id+'.json');await writeFile(file+'.tmp',JSON.stringify(record,null,2));await rename(file+'.tmp',file);await appendFile(path.join(root,'history.jsonl'),JSON.stringify(record)+'\n');return record})},
  event(id,event){valid(id);if(!event||typeof event!=='object'||!['html','cardspec'].includes(event.format)||JSON.stringify(event).length>45000)throw Object.assign(Error('invalid event'),{statusCode:400});return enqueue(async()=>{await mkdir(root,{recursive:true});await appendFile(path.join(root,'interactions.jsonl'),JSON.stringify({runId:WORKBENCH_RUN,id,at:new Date().toISOString(),event})+'\n');return {ok:true}})}
 }
}
