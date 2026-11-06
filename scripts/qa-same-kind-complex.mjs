import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createSameKindService} from '../server/cardspec/same-kind.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {complexCases} from './same-kind-complex-cases.mjs'
const root='artifacts/same-kind-complex',selection=process.argv[2],mode=process.argv[3]||'prepare';await mkdir(root,{recursive:true})
const service=createSameKindService({runner:async(spec,options)=>{const e=await runDebugBrowser(spec,options);await writeFile(`${root}/last-registration.json`,JSON.stringify(e));await writeFile(`${options.artifactDir}/registration.json`,JSON.stringify(e));return e}})
for(const c of complexCases.filter(c=>!selection||c.id===selection)){
 const context={expressionDialect:'js-v1',renderMode:'native',cardSize:'full',modelProfile:'default',userGoal:c.name}
 await writeFile(`${root}/${c.id}-baseline.cardspec`,c.source)
 try{
 if(mode==='prepare'){
  const at=Date.now(),compiled=compileCard(c.source,{final:true,context});await writeFile(`${root}/${c.id}-compile.json`,JSON.stringify(compiled.diagnostics))
  if(!compiled.complete)throw Error(JSON.stringify(compiled.diagnostics))
  const evidence=await runDebugBrowser(compiled.spec,{steps:c.steps,scenarios:['normal'],size:context.cardSize,signal:AbortSignal.timeout(60000),artifactDir:`${root}/${c.id}-baseline-check`});await writeFile(`${root}/${c.id}-baseline-check.json`,JSON.stringify(evidence))
  const b=await service.registerVerified({source:c.source,context,steps:c.steps},AbortSignal.timeout(60000));await writeFile(`${root}/${c.id}-baseline.json`,JSON.stringify({id:b.id,source:c.source,spec:compiled.spec,context,elapsedMs:Date.now()-at}));console.log(c.id,'VERIFIED',b.id)
 }else if(mode==='generate'){
  const b=JSON.parse(await readFile(`${root}/${c.id}-baseline.json`,'utf8')),at=Date.now(),r=await fetch('http://127.0.0.1:8787/api/cards/same-kind/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baselineId:b.id,prompt:c.prompt,modelProfile:'default'}),signal:AbortSignal.timeout(125000)}),data=await r.json();await writeFile(`${root}/${c.id}-reuse.json`,JSON.stringify({http:r.status,totalMs:Date.now()-at,...data}));console.log(c.id,'GENERATED',r.status,data.elapsedMs,data.error||'');if(data.source)await writeFile(`${root}/${c.id}-reuse.cardspec`,data.source)
 }else if(mode==='sizes'){
  const d=JSON.parse(await readFile(`${root}/${c.id}-reuse.json`,'utf8'));if(!d.spec)throw Error('no generated result')
  for(const size of ['square','auto','full']){const e=await runDebugBrowser(d.spec,{steps:c.steps,scenarios:['normal','empty','failure'],width:360,size,signal:AbortSignal.timeout(60000),artifactDir:`${root}/${c.id}-${size}`});await writeFile(`${root}/${c.id}-${size}.json`,JSON.stringify(e));console.log(c.id,size,e.status,e.runs.map(r=>({scenario:r.scenario,width:r.width,pass:r.actions.every(a=>a.ok&&a.assertion?.passed!==false),errors:r.final.errors,issues:r.final.layout?.issues}))) }
 }
 }catch(e){console.log(c.id,'FAILED',e.message);await writeFile(`${root}/${c.id}-${mode}-error.json`,JSON.stringify({error:e.message}))}
}
