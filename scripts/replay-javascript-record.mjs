// Replay an immutable model record under the current compiler. Never edits or
// replaces its original status, source, trace, model latency or pass rate.
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const options=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')))
if(!options.record||!options.out)throw Error('--record and --out are required')
const record=JSON.parse(await readFile(options.record,'utf8'))
const failures=record.trace.filter(e=>e.type==='diagnostics')
const attempt=options.attempt===undefined?null:Number(options.attempt)
if(attempt!==null&&(!Number.isInteger(attempt)||attempt<0||attempt>=failures.length))throw Error('Unknown diagnostic attempt')
const source=attempt===null?record.output?.source:failures[attempt].source
if(!source)throw Error('No source for requested attempt')
const context={expressionDialect:'js-v1',cardSize:'square',modelProfile:'default',userGoal:record.prompt,...record.output?.spec?.context,datasets:Object.fromEntries((record.records||[]).map(r=>[r.id,r.value]))}
const result=compileCard(source,{final:true,context,cardId:'offline-replay'})
// Preserve explicit research provenance for live dataset projection. This is
// host metadata, not a modification to the model's original source or outcome.
if(result.spec)result.spec.prefetched=structuredClone(record.records||[])
await validateRichContent(result)
const report={at:new Date().toISOString(),originalRecord:options.record,originalStatus:record.result.status,attempt,sourceHash:createHash('sha256').update(source).digest('hex'),source,spec:result.spec,complete:result.complete,diagnostics:result.diagnostics,qualification:'Current-compiler offline replay; no new model call, live tool, layout, or semantic parity claim. Original generation outcome remains unchanged.'}
await writeFile(options.out,JSON.stringify(report,null,2))
console.log(JSON.stringify({complete:report.complete,diagnostics:report.diagnostics,sourceHash:report.sourceHash}))
