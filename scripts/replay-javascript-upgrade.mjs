import {readFile,readdir,writeFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const root=process.argv[2]||'artifacts/javascript-upgrade/flash-js20',records=[]
for(const file of await readdir(root+'/adaptive-v1/r1')){
 const sample=JSON.parse(await readFile(root+'/adaptive-v1/r1/'+file,'utf8'))
 const originalContext=sample.message?.metadata?.card_spec?.context||{timeZone:'Asia/Shanghai',localDate:'2026-10-21',generatedAt:'2026-10-21T00:00:00Z',cardSize:'square'}
 const first=sample.frames.find(x=>x.frame.type==='diagnostics')?.frame.source||sample.source
 for(const [stage,source]of [['first',first],['final',sample.source]]){
  const result=compileCard(source,{final:true,context:{...originalContext,expressionDialect:'js-v1'}})
  await validateRichContent(result)
  records.push({id:sample.result.id,stage,complete:result.complete,diagnostics:result.diagnostics,interactionVerified:false})
 }
}
const summary={at:new Date().toISOString(),kind:'Offline replay with current compiler and final isolated-init validation. No new model calls; not a new generation pass rate or interaction verification.',total:records.length/2,first:records.filter(r=>r.stage==='first'&&r.complete).length,final:records.filter(r=>r.stage==='final'&&r.complete).length,records}
await writeFile(root+'/replay.json',JSON.stringify(summary,null,2))
console.log(JSON.stringify({total:summary.total,first:summary.first,final:summary.final,failures:records.filter(r=>r.stage==='final'&&!r.complete).map(r=>({id:r.id,errors:r.diagnostics.filter(d=>d.severity==='error')}))},null,2))
