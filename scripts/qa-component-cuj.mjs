import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {validateRichContent} from '../server/cardspec/rich-validation.mjs'
import {journeyCoverage} from '../server/cardspec/journey-coverage.mjs'
import {componentSelection} from '../shared/cardspec/component-selection.mjs'
import {registryReference} from '../shared/cardspec/registry.mjs'

const root='artifacts/component-cuj-qa';await mkdir(root,{recursive:true})
const results=[]
async function run(id,spec,goal,steps,expectedFailure=false){
 const result=await runDebugBrowser(spec,{steps,scenarios:['normal'],viewports:[432,320],size:'full',captureSteps:true,artifactDir:`${root}/${id}`})
 const failures=(result.runs||[]).flatMap(r=>r.actions.filter(a=>!a.ok||a.assertion?.passed===false).map(a=>({width:r.width,name:a.step.name,ok:a.ok,failures:a.assertion?.failures,error:a.error})))
 const outcome={id,status:result.status,expectedFailure,failures,cuj:journeyCoverage(goal,spec,result),evidenceMatched:result.status==='tested'&&(expectedFailure?failures.some(f=>f.ok&&f.failures?.length):!failures.length)&&result.runs.every(r=>!r.final.errors.length)}
 results.push(outcome);await writeFile(`${root}/${id}/trace.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(outcome))
 await writeFile(root+'/results.json',JSON.stringify(results,null,2))
}
const existing=async i=>JSON.parse(await readFile(`artifacts/recent-card-review/${i}-spec.json`,'utf8'))
await run('route-consistency',await existing(3),'选择路线后日程与所选路线天数一致',[
 {op:'click',name:'选这条',index:2,requirement:'R1',expect:{relations:[{left:'derived.plan.length',op:'eq',right:'derived.cur.days'}]}},
],true)
await run('loop-continuation',await existing(0),'两次合法行动后可以继续下一阶段',[
 ...Array.from({length:2},()=>[{op:'click',name:'放入',index:0},{op:'click',name:'放入',index:0},{op:'click',name:'推进阶段'}]).flat(),
 {op:'check',requirement:'R1',expect:{state:{phase:2,acts:2}}},
],true)
const sandbox='<card design="atlas"><sandbox id="quiz" brief="分步学习" height={260} initial={{step:0,answer:"",score:0}} source={`export default function App({state,setState}){return <div><h2>学习实验</h2>{state.step===0?<div><button onClick={()=>setState({...state,answer:"B",score:1,step:1})}>选择B</button></div>:state.step===1?<div><p>回答正确，得分1</p><button onClick={()=>setState({...state,step:2})}>查看解释</button><button onClick={()=>setState({...state,step:0})}>重新作答</button></div>:<div><p>解释：参数增加使结果增加</p><button onClick={()=>setState({...state,step:1})}>返回结果</button></div>}</div>}`}/></card>'
const compiled=compileCard(sandbox,{final:true,context:{renderMode:'hybrid',expressionDialect:'js-v1'}});await validateRichContent(compiled)
if(!compiled.complete)throw Error(JSON.stringify(compiled.diagnostics))
await writeFile(root+'/sandbox.cardspec',sandbox)
await run('sandbox-journey',compiled.spec,'作答后查看结果；查看解释并返回；刷新后保留结果',[
 {op:'click',name:'选择B',requirement:'R1',expect:{text:'回答正确，得分1',controls:[{name:'查看解释',enabled:true}]}},
 {op:'click',name:'查看解释',expect:{text:'解释：参数增加使结果增加'}},
 {op:'click',name:'返回结果',requirement:'R2',expect:{text:'回答正确，得分1'}},
 {op:'reload',requirement:'R3',expect:{text:'回答正确，得分1',controls:[{name:'查看解释',enabled:true}]}},
])
const oldNames=['task-board','settings','choice-grid','choice-item','tool-view','experience','collection','table','title','text','caption','strong','button','row','region','stat','stats','input','slider','segmented','image','chart','map','slot','if','each','checkbox','toggle','progress','icon','box','stack','grid','badge','list','list-group','list-item','select','link']
const metrics=['计数器','门店搜索和详情','旅行路线和预算','关系原理与因果','矩阵激活模拟器','原创SVG动画'].map(goal=>{const current=componentSelection(goal,{renderMode:'hybrid',toolsEnabled:true});return {goal,beforeCount:oldNames.length,afterCount:current.names.length,beforeContractCharacters:registryReference({compact:true,names:oldNames}).length,afterContractCharacters:registryReference({compact:true,names:current.names}).length,...current}})
await writeFile(root+'/disclosure.json',JSON.stringify(metrics,null,2))
if(results.some(r=>!r.evidenceMatched))process.exitCode=1
