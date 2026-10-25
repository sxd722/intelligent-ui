import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const record=JSON.parse(await readFile('artifacts/javascript-upgrade/deep-baselines-r5/transformer.json','utf8'))
const call=record.modelCalls.at(-1),source=call.content
const contextMatch=call.messages.filter(m=>m.role==='system').map(m=>m.content?.match(/可信上下文：(\{[^\n]*\})。仅完成/)).find(Boolean)
if(!contextMatch)throw Error('Missing original context')
const result=compileCard(source,{final:true,context:JSON.parse(contextMatch[1])});await validateRichContent(result)
const replay={at:new Date().toISOString(),originalStatus:record.result.status,originalError:record.result.error,sourceHash:createHash('sha256').update(source).digest('hex'),complete:result.complete,diagnostics:result.diagnostics,logicProbes:result.logicProbes,source,spec:result.spec,qualification:'Unmodified final output replay after js-v1 prose braces became inert text. Original failed generation remains failed. No mathematical/visual parity claim.'}
await writeFile('artifacts/javascript-upgrade/transformer-r5-replay.json',JSON.stringify(replay,null,2))
console.log(JSON.stringify({complete:replay.complete,diagnostics:replay.diagnostics,logicProbes:replay.logicProbes}))
