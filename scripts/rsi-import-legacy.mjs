// Preserve historical judgments without calling them independent training labels.
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {digest} from '../server/rsi-records.mjs'
import {WORKBENCH_CASES,WORKBENCH_RUN} from '../shared/workbench-cases.mjs'
const root='artifacts/rsi-data',records=[];await mkdir(root,{recursive:true})
for(const c of WORKBENCH_CASES){let feedback;try{feedback=JSON.parse(await readFile(`artifacts/${WORKBENCH_RUN}/feedback/${c.id}.json`,'utf8'))}catch{}
 for(const format of ['cardspec','html']){try{const trace=JSON.parse(await readFile(`artifacts/${WORKBENCH_RUN}/${c.id}-${format}.json`,'utf8')),record=trace.record,artifactHash=digest(record.source||'');records.push({schemaVersion:1,caseId:c.id,format,producer:'glm-api',artifactHash,sourcePath:`artifacts/${WORKBENCH_RUN}/${c.id}-${format}.json`,status:record.status,elapsedMs:record.elapsedMs,judgment:feedback?.feedback?.[format]||null,preference:feedback?.feedback?.preference||null,feedbackRevision:feedback?.revision,binding:'legacy-case-level-unverified',trainingEligible:false,blockers:['historical feedback was not originally bound to exact source','independent interaction and fact review required']})}catch(e){records.push({caseId:c.id,format,status:'missing',error:e.message,trainingEligible:false})}}
}
await writeFile(root+'/legacy-index.json',JSON.stringify({schemaVersion:1,importedAt:new Date().toISOString(),run:WORKBENCH_RUN,records},null,2));console.log(JSON.stringify({artifacts:records.length,eligible:0,reason:'Historical labels preserved; no inferred approvals'}))
