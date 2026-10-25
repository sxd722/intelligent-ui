import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
const root='artifacts/javascript-upgrade'
const record=JSON.parse(await readFile(root+'/family-r5-next-page.json','utf8'))
const diagnostic=record.trace.find(x=>x.type==='diagnostics')
const match=record.calls[0].messages.filter(m=>m.role==='system').map(m=>m.content?.match(/可信上下文：(\{[^\n]*\})。仅完成/)).find(Boolean)
if(!match||!diagnostic?.source)throw Error('Missing original generation evidence')
const source=diagnostic.source,context=JSON.parse(match[1])
// The original runner seeded research datasets from these records. No CLI read
// occurred during this request; restore the same host-only compilation context.
const parent=JSON.parse(await readFile(root+'/deep-baselines-r5/family.json','utf8'))
context.datasets=createGenerationTools({initialRecords:parent.output.spec.prefetched}).datasets()
const result=compileCard(source,{final:true,context});await validateRichContent(result)
const replay={at:new Date().toISOString(),originalStatus:record.status,sourceHash:createHash('sha256').update(source).digest('hex'),complete:result.complete,diagnostics:result.diagnostics,logicProbes:result.logicProbes,source,spec:result.spec,qualification:'Unmodified first next-page output after adding enforced minItems schema support. Does not change original failed generation status. UI, itinerary semantics and subsequent model calls remain unverified.'}
await writeFile(root+'/family-r5-next-page-replay.json',JSON.stringify(replay,null,2))
console.log(JSON.stringify({complete:replay.complete,diagnostics:replay.diagnostics}))
