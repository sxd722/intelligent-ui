import {createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'

export const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex')
export async function recordAdaptiveGeneration({requestId,goal,results=[],budget,error,parentPageId},{root='artifacts/rsi-adaptive/runs'}={}){
 if(!/^[\w-]{1,128}$/.test(requestId))throw Error('Invalid RSI run ID')
 const artifacts=results.map(r=>{
  const artifactHash=digest({source:r.source,spec:r.spec,module:r.module}),compiled=!!(r.spec||r.module)
  return {caseId:digest(goal),track:r.module?'cardspec-react-enhancement':r.spec?.context?.renderMode==='hybrid'?'cardspec-hybrid':'cardspec-native',artifactHash,status:compiled?'compiled':'failed',source:r.source||r.module?.source,spec:r.spec,module:r.module,diagnostics:r.diagnostics,
   gate:trainingReadiness({status:compiled?'compiled':'failed',artifactHash},null,null)}
 })
 const record={version:1,requestId,createdAt:new Date().toISOString(),goal,parentPageId,profiles:{harness:'adaptive-v1',prompt:'adaptive-v1.1',compositions:'1',numeric:'1'},budget,error,artifacts,
  comparison:{baseline:'h5-baseline',matchedArtifactHash:null,humanReviewRequired:true},trainingEligible:false}
 await mkdir(root,{recursive:true});await writeFile(path.join(root,requestId+'.json'),JSON.stringify(record,null,2))
 return record
}
export function validateFeedback(record,artifact){
 if(!record||record.caseId!==artifact.caseId||record.track!==artifact.track||record.artifactHash!==artifact.artifactHash)throw Error('Feedback does not match immutable artifact')
 for(const k of ['任务完成','视觉表达','互动价值','信息可信'])if(record[k]!==undefined&&record[k]!==''&&(!Number.isInteger(Number(record[k]))||Number(record[k])<1||Number(record[k])>5))throw Error('Invalid rating')
 if(typeof record.note==='string'&&record.note.length>10000)throw Error('Feedback too long')
 return {...record,reviewStatus:'unreviewed',trainingEligible:false}
}
export function trainingReadiness(artifact,qa,review){
 const blockers=[]
 if(artifact.status!=='compiled')blockers.push('compile')
 const coverage=new Set((qa?.results||[]).filter(x=>x.passed).map(x=>`${x.width}:${x.size}`))
 if(qa?.artifactHash!==artifact.artifactHash||![320,360,432].every(w=>['square','auto'].every(s=>coverage.has(`${w}:${s}`)))||qa.results.some(x=>!x.passed))blockers.push('browser-qa')
 if(review?.artifactHash!==artifact.artifactHash||review?.approved!==true||review?.reviewer!=='human')blockers.push('human-review')
 if(review?.factsVerified!==true)blockers.push('facts')
 if(review?.taskComplete!==true)blockers.push('task-completeness')
 return {eligible:blockers.length===0,blockers}
}
