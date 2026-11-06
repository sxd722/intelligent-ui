// Local maintenance only: reuse host-owned traces, never accept workspace/code
// snapshots from a public API or reconnect OpenCLI to perform this regression.
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {generationCallOptions} from '../server/cardspec/build-policy.mjs'
import {createGenerationBudget,generationPolicy} from '../server/cardspec/budget.mjs'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const name=process.argv[2],id=process.argv[3],dir=`artifacts/requirement-planning-qa/${name}`
const previous=JSON.parse(await readFile(`artifacts/deep-build/${id}/trace.json`,'utf8'))
// Older traces did not persist the inherited commit ledger. Reconstruct only
// recorded commits through host-owned ancestry; never infer them from code.
const inherited=new Set(previous.committedUnits||[]),seen=new Set([id]);let ancestor=previous
while(ancestor){
 for(const t of ancestor.trace||[])if(t.kind==='unit-commit')inherited.add(t.unit)
 for(const unit of ancestor.committedUnits||[])inherited.add(unit)
 const parent=ancestor.trace?.find(t=>t.kind==='resume')?.sourceId
 if(!parent||seen.has(parent))break;seen.add(parent)
 ancestor=JSON.parse(await readFile(`artifacts/deep-build/${parent}/trace.json`,'utf8'))
 if(ancestor.goal!==previous.goal)throw Error('resume ancestry goal mismatch')
}
previous.committedUnits=[...inherited]
const request=JSON.parse(await readFile(dir+'/request.json','utf8')),cardId=randomUUID()
const context={buildMode:'deep',renderMode:request.renderMode,expressionDialect:'js-v1',cardSize:request.cardSize,extendedGeneration:!!request.extendedGeneration,viewport:{width:432,height:900}}
const key=loadApiKey();if(!key.ok)throw Error('model key unavailable')
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:key.value,model:'glm-5.3-flash'})
const budget=createGenerationBudget(generationPolicy(previous.goal,{buildMode:'deep'})),signal=AbortSignal.timeout(600000)
const debug=createDebugSession({context:()=>context,budget,cardId}),started=Date.now()
const events=[]
try{
 const result=await buildDeepCard({input:{prompt:previous.goal},context,debug,budget,signal,cardId,resume:{...previous,sourceId:id},emit:e=>{events.push(e);if(e.message)console.log(name,Math.round((Date.now()-started)/1000),e.message)},streamUpstream:async(messages,options)=>{
  budget.model(options.stage||'generate')
  return (await round(messages,{...generationCallOptions(request,options),webApplication:request.renderMode==='web'})).message.content
 }})
 const compiled=compileCard(result.source,{final:true,cardId,context});await validateRichContent(compiled)
 if(!compiled.complete||compiled.diagnostics.some(d=>d.severity==='error'))throw Error('final compile failed: '+JSON.stringify(compiled.diagnostics))
 compiled.spec.deepBuild=result.build;compiled.spec.requirementCoverage=result.coverage
 await writeFile(dir+'/spec.json',JSON.stringify(compiled.spec,null,2));await writeFile(dir+'/source.cardspec',result.source)
 await writeFile(dir+'/summary.json',JSON.stringify({name,status:'succeeded',cardId,resumedFrom:id,elapsedMs:previous.elapsedMs+Date.now()-started,resumeElapsedMs:Date.now()-started,metadata:{generationBudget:budget.snapshot()},coverage:result.coverage},null,2))
 console.log(name,'SUCCEEDED',cardId)
}catch(e){await writeFile(dir+'/resume-failure.json',JSON.stringify({status:'failed',message:e.message,cardId,resumedFrom:id,elapsedMs:Date.now()-started,budget:budget.snapshot()},null,2));console.log(name,'FAILED',e.message)}
finally{await writeFile(dir+'/resume-events.json',JSON.stringify(events,null,2))}
