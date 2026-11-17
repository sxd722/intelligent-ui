import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
const root='artifacts/mountains-delivery-qa'
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''))
const original='artifacts/generation-debug/fc7d8ab7-afcc-4cb3-82ad-0aec6e98d651/b8c539d54cd4e637df95'
const source=await readFile(original+'/candidate.cardspec','utf8'),old=await read(original+'/test-3.json')
const context={renderMode:'hybrid',expressionDialect:'js-v1',cardSize:'auto',extendedGeneration:true}
await mkdir(root,{recursive:true})
const runner=(dir)=>(spec,o)=>runDebugBrowser(spec,{...o,viewports:[432,320],size:'auto',captureSteps:true,artifactDir:root+'/'+dir})
const d=createDebugSession({context:()=>context,artifactRoot:root+'/debug',cardId:'original-path',runner:runner('original-path')})
const first=await d.test({source,steps:old.steps})
for(let i=0;i<3;i++)await d.rejectRequest('Controlled replay of original malformed test submission '+i)
const saved=d.stopResult()
await writeFile(root+'/retention.json',JSON.stringify({first,retained:{...saved,source:undefined},sourceUnchanged:saved?.source===source},null,2))
console.log(JSON.stringify({phase:'original',status:first.status,retained:saved?.selection,unchanged:saved?.source===source}))
const steps=[
 {op:'click',role:'radio',name:'海上穿越',expect:{state:{stage:'drake'},text:'单程约2天'}},
 {op:'click',role:'radio',name:'行前准备',expect:{state:{stage:'prep'},text:'乌斯怀亚港登船'}},
 {op:'click',name:'远征打包清单',expect:{text:'出发前逐项确认'}},
 {op:'click',role:'checkbox',name:'晕船药（提前咨询医生）',expect:{derived:{packedCount:1}}},
 {op:'click',name:'关闭详情'},
 {op:'click',name:'展开补充详情',expect:{state:{showDetail:true},text:'热门月份船位紧'}},
 {op:'click',role:'radio',name:'目标区域',expect:{state:{stage:'peak',showDetail:false},text:'小说坐标处的'}},
 {op:'click',role:'radio',name:'行前准备',expect:{state:{stage:'prep'},derived:{packedCount:1}}},
 {op:'reload',expect:{state:{stage:'prep'},derived:{packedCount:1}}},
 {op:'click',role:'radio',name:'海上穿越',expect:{state:{stage:'drake'}}},
 {op:'click',name:'展开补充详情',expect:{state:{showDetail:true},text:'信天翁'}},
]
await writeFile(root+'/corrected-steps.json',JSON.stringify(steps,null,2))
const correct=createDebugSession({context:()=>context,artifactRoot:root+'/debug',cardId:'corrected-path',runner:runner('corrected-path')})
const feedback=await correct.test({source,steps})
const evidence=correct.evidence()
await writeFile(root+'/corrected-trace.json',JSON.stringify(correct.snapshot(),null,2))
const summary={sourceSha256:createHash('sha256').update(source).digest('hex'),originalVersion:old.version,modelCalls:0,sourceUnchanged:saved?.source===source,retained:saved?.selection,correctedStatus:feedback.status,runs:evidence.runs?.map(r=>({width:r.width,steps:r.actions.map(a=>({name:a.step.name||a.step.op,ok:a.ok,assertion:a.assertion?.passed,restored:a.restored,error:a.error,failures:a.assertion?.failures})),errors:r.pageErrors,layout:r.final?.layout})),scope:'Original model source; only test steps corrected. No new generation or factual content validation.'}
await writeFile(root+'/summary.json',JSON.stringify(summary,null,2))
const compiled=compileCard(source,{final:true,context});await validateRichContent(compiled)
await writeFile(root+'/spec.json',JSON.stringify(compiled.spec))
await writeFile(root+'/source.cardspec',source)
console.log(JSON.stringify(summary))
if(!saved?.source||!evidence.runs?.every(r=>r.actions.every(a=>a.ok&&a.assertion?.passed!==false&&a.restored!==false)&&!r.pageErrors?.length))process.exitCode=1
