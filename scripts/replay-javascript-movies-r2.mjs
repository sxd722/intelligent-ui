import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const path='artifacts/javascript-upgrade/deep-baselines-r2/movies.json',record=JSON.parse(await readFile(path,'utf8'))
const call=record.modelCalls.at(-1),source=call.content
const contextMatch=call.messages.filter(m=>m.role==='system').map(m=>m.content?.match(/可信上下文：(\{[^\n]*\})。仅完成/)).find(Boolean)
if(!contextMatch)throw Error('Original generation context is missing; do not substitute a new context')
const context=JSON.parse(contextMatch[1])
const result=compileCard(source,{final:true,context});await validateRichContent(result)
const replay={at:new Date().toISOString(),originalStatus:record.result.status,originalError:record.result.error,sourceHash:createHash('sha256').update(source).digest('hex'),complete:result.complete,diagnostics:result.diagnostics,source,spec:result.spec,qualification:'Offline replay after generic list.label support. Original model generation remains failed; this is not a new model success or functional verification.'}
await writeFile('artifacts/javascript-upgrade/movies-r2-replay.json',JSON.stringify(replay,null,2))
console.log(JSON.stringify({complete:replay.complete,diagnostics:replay.diagnostics,sourceHash:replay.sourceHash}))
