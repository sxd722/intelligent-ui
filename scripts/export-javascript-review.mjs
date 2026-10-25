import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {JAVASCRIPT_BASELINES} from './javascript-baseline-cases.mjs'
const runs=['deep-baselines','deep-baselines-r2','deep-baselines-r3','deep-baselines-r4','deep-baselines-r5','deep-baselines-r6','deep-baselines-r7','deep-baselines-r8','flash-baselines-r9','flash-baselines-r10','deep-baselines-r11','flash-baselines-r12','deep-baselines-r13'],root='artifacts/javascript-upgrade'
runs.push('deep-baselines-r14')
runs.push('deep-baselines-r15')
const results=[]
for(const run of runs)for(const c of JAVASCRIPT_BASELINES){
 let record
 try{record=JSON.parse(await readFile(`${root}/${run}/${c.id}.json`,'utf8'))}catch(e){if(e.code==='ENOENT')continue;throw e}
 // Local review bundle contains only the generated artifact. Full reasoning and
 // request traces stay in artifacts/, not in the public document root.
 results.push({run,id:c.id,prompt:record.prompt||'(原记录未保存任务要求)',result:record.result,output:record.output&&{source:record.output.source,spec:record.output.spec,resources:record.output.resources},diagnostics:record.trace.filter(v=>v.type==='diagnostics').map(({attempt,message})=>({attempt,message}))})
}
try{
 const replay=JSON.parse(await readFile(root+'/movies-r2-replay.json','utf8'))
 const original=results.find(r=>r.id==='movies'&&r.run==='deep-baselines-r2')
 if(original&&replay.complete)results.push({...original,run:'deep-baselines-r2-offline-replay',result:{...original.result,status:'offline-replay',sourceHash:replay.sourceHash},output:{source:replay.source,spec:replay.spec,resources:{}},diagnostics:[{message:replay.qualification},...replay.diagnostics]})
}catch(e){if(e.code!=='ENOENT')throw e}
try{
 const replay=JSON.parse(await readFile(root+'/family-r10-offline.json','utf8'))
 const original=results.find(r=>r.id==='family'&&r.run==='flash-baselines-r10')
 if(original&&replay.complete)results.push({...original,run:'flash-baselines-r10-offline-replay',result:{...original.result,status:'offline-replay',sourceHash:replay.sourceHash},output:{source:replay.source,spec:replay.spec,resources:{}},diagnostics:[{message:replay.qualification},...replay.diagnostics]})
}catch(e){if(e.code!=='ENOENT')throw e}
await mkdir('public/javascript-upgrade',{recursive:true})
try{
 const replay=JSON.parse(await readFile(root+'/family-r12-first-offline.json','utf8'))
 const original=results.find(r=>r.id==='family'&&r.run==='flash-baselines-r12')
 if(original&&replay.complete)results.push({...original,run:'flash-baselines-r12-first-offline-replay',result:{...original.result,status:'offline-replay',sourceHash:replay.sourceHash},output:{source:replay.source,spec:replay.spec,resources:{}},diagnostics:[{message:replay.qualification},...replay.diagnostics]})
}catch(e){if(e.code!=='ENOENT')throw e}
try{
 const replay=JSON.parse(await readFile(root+'/sentiment-r14-offline.json','utf8'))
 const original=results.find(r=>r.id==='sentiment'&&r.run==='deep-baselines-r14')
 if(original&&replay.complete)results.push({...original,run:'deep-baselines-r14-offline-replay',result:{...original.result,status:'offline-replay',sourceHash:replay.sourceHash},output:{source:replay.source,spec:replay.spec,resources:{}},diagnostics:[{message:replay.qualification},...replay.diagnostics]})
}catch(e){if(e.code!=='ENOENT')throw e}
try{
 const replay=JSON.parse(await readFile(root+'/transformer-r15-first-offline.json','utf8'))
 const original=results.find(r=>r.id==='transformer'&&r.run==='deep-baselines-r15')
 if(original&&replay.complete)results.push({...original,run:'deep-baselines-r15-first-offline-replay',result:{...original.result,status:'offline-replay',sourceHash:replay.sourceHash},output:{source:replay.source,spec:replay.spec,resources:{}},diagnostics:[{message:replay.qualification},...replay.diagnostics]})
}catch(e){if(e.code!=='ENOENT')throw e}
await writeFile('public/javascript-upgrade/results.json',JSON.stringify({at:new Date().toISOString(),results},null,2))
console.log(`Exported ${results.length} generated results for local review`)
