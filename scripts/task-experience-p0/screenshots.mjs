import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {runDebugBrowser} from '../../server/cardspec/debug-browser.mjs'
import {makeScope,createStore} from '../../shared/cardspec/store.mjs'
import {evaluate} from '../../shared/cardspec/expression.mjs'
import {canonicalInput} from '../../shared/cardspec/prefetch.mjs'
import {coverageDiagnostics} from '../../shared/cardspec/task-evidence.mjs'
import {taskBehaviorDiagnostics} from '../../shared/cardspec/task-behavior.mjs'
const root='artifacts/task-experience-p0',phase=process.env.P0_PHASE||'baseline'
for(const name of ['traffic','travel','news',...(phase==='baseline'?[]:['appointment','schedule','reviews'])]){
 if(process.env.P0_ONLY&&!process.env.P0_ONLY.split(',').includes(name))continue
 let r;try{r=JSON.parse(await fs.readFile(phase==='baseline'?`${root}/${name}-baseline.json`:`${root}/${phase}/${name}.json`))}catch{continue}
 const spec=structuredClone(phase==='baseline'?r.artifacts[0].spec:r.spec);if(!spec)continue
 const scope=makeScope(spec,createStore()),replay=[]
 for(const [id,b]of Object.entries(spec.bindings||{})){
  let input;try{input=evaluate(b.input,scope)}catch{}
  const record=(spec.prefetched||[]).find(r=>r.tool===b.tool&&canonicalInput(r.input)===canonicalInput(input))
  if(record){b.initial={type:'literal',value:record.value};replay.push({binding:id,dataset:record.id,tool:b.tool,mode:'recorded-return'})}
  else replay.push({binding:id,mode:'no-matching-record'})
  b.load='manual';delete b.refresh
 }
 const sourceHash=createHash('sha256').update(JSON.stringify(spec)).digest('hex')
 const directory=`${root}/browser/${phase}/${name}`;await fs.mkdir(directory,{recursive:true})
 const diagnostics=[...coverageDiagnostics(spec,spec.prefetched||[]),...taskBehaviorDiagnostics(spec)]
 for(const size of ['full','square']){
  const out=`${directory}/${size}`;if(await fs.readFile(out+'/browser.json','utf8').then(s=>{const saved=JSON.parse(s);return saved.sourceHash===sourceHash&&saved.status==='tested'&&saved.runs?.length===3&&saved.runs.every(r=>r.screenshot)},()=>false))continue
  const result=await runDebugBrowser(spec,{steps:[{op:'check'}],viewports:[432,360,320],scenarios:['normal'],size,artifactDir:out,signal:AbortSignal.timeout(90000)})
  await fs.writeFile(out+'/browser.json',JSON.stringify({phase,name,size,sourceHash,replay,diagnostics,...result},null,2));console.log(JSON.stringify({phase,name,size,status:result.status,errors:result.runs?.map(r=>r.final.errors),issues:result.runs?.map(r=>r.final.layout?.issues?.length)}))
 }
}
