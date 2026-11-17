// Offline evidence audit. Never mutates run metadata or generated artifacts.
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
const root=path.resolve(process.argv.find(x=>x.startsWith('--study='))?.slice(8)||'experiments/round1-20261117')
const hash=s=>createHash('sha256').update(s).digest('hex')
const read=async(p,fallback=null)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
const limits={modelRequests:8,uniqueRepairVersions:2,elapsedMs:240000}
const records=[],skipped=[]
for(const entry of await fs.readdir(path.join(root,'runs'),{withFileTypes:true})){
 if(!entry.isDirectory())continue
 const dir=path.join(root,'runs',entry.name),run=await read(path.join(dir,'run.json'))
 if(!run){skipped.push({runId:entry.name,reason:'run.json absent; may still be running'});continue}
 const rounds=await read(path.join(dir,'rounds.json'),[]),wire=await read(path.join(dir,'actual-requests.json'),[]),proposalByHash=new Map()
 function proposal(source,round,kind){if(typeof source!=='string'||!source)return;const h=hash(source);if(!proposalByHash.has(h))proposalByHash.set(h,[]);proposalByHash.get(h).push({round:round.index,shared:round.charged===false,kind})}
 for(const r of rounds){
  const message=r.response?.message||{}
  if(typeof message.content==='string')proposal(message.content,r,'content')
  for(const c of message.tool_calls||[])try{const a=JSON.parse(c.function?.arguments||'{}');if(typeof a.source==='string')proposal(a.source,r,c.function.name)}catch{}
 }
 let names=[];try{names=(await fs.readdir(path.join(dir,'source-versions'))).filter(n=>n.endsWith('.cardspec')).sort()}catch(e){if(e.code!=='ENOENT')throw e}
 const versions=[],seen=new Map()
 for(const name of names){const source=await fs.readFile(path.join(dir,'source-versions',name),'utf8'),h=hash(source),metadata=await read(path.join(dir,'source-versions',name.replace('.cardspec','.json')),{}),card=/<card(?:\s|>)/.test(source),invalidDSML=/<[｜|]*DSML[｜|]*/i.test(source)
  versions.push({file:name,sourceHash:h,chars:source.length,hasCardTag:card,invalidDSML,compiled:!!metadata.spec,duplicateOf:seen.get(h)||null,modelOrigins:proposalByHash.get(h)||[],origin:(proposalByHash.get(h)||[]).length?'model-output-matched':'host-or-unmatched',diagnosticCodes:[...new Set((metadata.diagnostics||[]).map(d=>d.code))]});if(!seen.has(h))seen.set(h,name)
 }
 let events=[];try{events=(await fs.readFile(path.join(dir,'trace.redacted.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse)}catch(e){if(e.code!=='ENOENT')throw e}
 const budgetError=events.find(e=>/2 directed source repair versions exhausted/.test(e.message||e.error||'')),subsequentCalls=budgetError?rounds.filter(r=>r.charged!==false&&r.startedAtMs>=budgetError.atMs).map(r=>r.index):[]
 const browserRecords=[];for(const file of (await fs.readdir(dir)).filter(n=>/^browser-\d+\.json$/.test(n))){const b=await read(path.join(dir,file));browserRecords.push({file,sourceHash:b.sourceHash,shared:!!b.sharedFrom,contextHash:b.contextHash})}
 const initial=versions[0]?.sourceHash,uniqueAfter=versions.filter(v=>!v.duplicateOf&&v.sourceHash!==initial),cardRepairs=uniqueAfter.filter(v=>v.hasCardTag&&v.modelOrigins.some(o=>!o.shared)),invalid=uniqueAfter.filter(v=>!v.hasCardTag),duplicates=versions.filter(v=>v.duplicateOf)
 const duplicateModelResubmissions=[...seen.keys()].reduce((n,h)=>{const callbacks=versions.filter(v=>v.sourceHash===h).length,modelRounds=new Set((proposalByHash.get(h)||[]).map(o=>o.round)).size;return n+Math.min(Math.max(0,callbacks-1),Math.max(0,modelRounds-1))},0)
 const charged=wire.length,shared=run.usage?.sharedDraftCalls??rounds.filter(r=>r.charged===false).length,total=charged+shared,elapsed=run.usage?.elapsedMs??null
 const actualTransitions=versions.slice(1).filter((v,i)=>v.sourceHash!==versions[i].sourceHash).length
 const checks={modelRequestLimit:total<=limits.modelRequests?'passed':'failed',wallClockLimit:elapsed==null?'unknown':elapsed<=limits.elapsedMs?'passed':'failed',uniqueCardSpecRepairLimit:cardRepairs.length<=limits.uniqueRepairVersions?'passed':'failed',allUniqueSubmittedTextLimit:uniqueAfter.length<=limits.uniqueRepairVersions?'passed':'failed',stopAfterRepairBudgetError:subsequentCalls.length?'failed':'passed'}
 // Invalid protocol text and duplicates make the raw callback counter ambiguous;
 // keep both definitions rather than silently choosing a favorable denominator.
 const ambiguous=invalid.length>0&&uniqueAfter.length>limits.uniqueRepairVersions&&cardRepairs.length<=limits.uniqueRepairVersions
 const violations=Object.entries(checks).filter(([k,v])=>v==='failed'&&k!=='allUniqueSubmittedTextLimit').map(([k])=>k)
 const protocolDeviation=violations.length>0||ambiguous
 records.push({runId:entry.name,condition:run.condition,reportedRepairs:run.usage?.repairs??null,callbackSourceTransitionsAfterInitial:actualTransitions,uniqueSubmittedTextsAfterInitial:uniqueAfter.length,uniqueModelCardSpecRepairProposals:cardRepairs.length,nonCardSpecUniqueTexts:invalid.length,invalidDSML:versions.some(v=>v.invalidDSML),invalidDSMLUniqueCount:uniqueAfter.filter(v=>v.invalidDSML).length,duplicateCallbacks:duplicates.length,duplicateModelResubmissions,duplicateCallbacksWithoutAdditionalModelRound:duplicates.length-duplicateModelResubmissions,hostOrUnmatchedCallbacks:versions.filter(v=>v.origin==='host-or-unmatched').length,browserRecords:browserRecords.length,incrementalBrowserRuns:browserRecords.filter(b=>!b.shared).length,sharedBrowserRecords:browserRecords.filter(b=>b.shared).length,uniqueRepairHashesWithBrowserEvidence:cardRepairs.filter(v=>browserRecords.some(b=>b.sourceHash===v.sourceHash)).length,modelCalls:{charged,shared,total},elapsedMs:elapsed,checks,subsequentModelCallsAfterRepairBudgetError:subsequentCalls,protocolDeviation,winnerEligible:protocolDeviation?false:null,winnerEligibilityNote:protocolDeviation?'Not eligible as equal-budget winner evidence':'Budget audit alone does not establish task/quality eligibility',ambiguousVersionDefinition:ambiguous,violations,versions,browserEvidence:browserRecords})
}
const doc={generatedAt:new Date().toISOString(),mode:'offline-read-only-audit',limits,definitions:{uniqueModelCardSpecRepairProposals:'Distinct callback sources containing <card> matched to model output, excluding initial and exact duplicates; includes compile-invalid CardSpec.',uniqueSubmittedTextsAfterInitial:'All distinct callback strings after initial, including malformed tool serialization.',callbackSourceTransitionsAfterInitial:'Adjacent changed-source callbacks; this is what the original runner counted as repairs.',winnerEligible:'false identifies protocol deviation; null means business and independent acceptance are still required.',modelRequests:'Actual wire requests plus shared initial requests; shared cost itself is charged once.'},counts:{completedRecords:records.length,protocolDeviations:records.filter(r=>r.protocolDeviation).length,invalidDSML:records.filter(r=>r.invalidDSML).length},records,skipped}
await fs.writeFile(path.join(root,'budget-compliance.json'),JSON.stringify(doc,null,2))
console.log(JSON.stringify(doc.counts))
