import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {getQuickJS} from 'quickjs-emscripten'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {evaluate} from '../shared/cardspec/expression.mjs'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const root='artifacts/javascript-upgrade'
for(const id of ['family','transformer']){
 const record=JSON.parse(await readFile(`${root}/flash-baselines-r10/${id}.json`,'utf8'))
 const source=record.trace.filter(e=>e.type==='diagnostics').at(-1).source
 const context={expressionDialect:'js-v1',modelProfile:'default',cardSize:'square',userGoal:record.prompt,datasets:Object.fromEntries(record.records.map(r=>[r.id,r.value]))}
 const result=compileCard(source,{final:true,context,cardId:`r10-offline-${id}`})
 await validateRichContent(result)
 const logicErrors=[]
 async function inspect(nodes){for(const n of nodes){if(n.type==='logic')try{executeLogic(await getQuickJS(),{source:evaluate(n.props.source,{}),state:evaluate(n.props.initial,{}),event:{type:'init'}})}catch(e){logicErrors.push({nodeId:n.id,error:e.message})}await inspect(n.children||[])}}
 await inspect(result.spec?.children||[])
 const report={at:new Date().toISOString(),id,sourceHash:createHash('sha256').update(source).digest('hex'),source,spec:result.spec,complete:result.complete,diagnostics:result.diagnostics,logicErrors,qualification:'Unmodified failed R10 final source recompiled offline with current host. Original model failure remains unchanged. No live tools or model calls; not functional/layout/math parity.'}
 await writeFile(`${root}/${id}-r10-offline.json`,JSON.stringify(report,null,2))
 console.log(JSON.stringify({id,complete:result.complete,diagnostics:result.diagnostics,logicErrors}))
}
