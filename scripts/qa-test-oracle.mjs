import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createDebugSession} from '../server/cardspec/debug-session.mjs'
import {runDebugBrowser} from '../server/cardspec/debug-browser.mjs'
const root='artifacts/test-oracle-qa';await mkdir(root,{recursive:true})
const read=async p=>JSON.parse(await readFile(p,'utf8')),selected=process.argv[2],results=selected?(await read(root+'/results.json')).filter(r=>r.id!==selected):[]
const motionRoot='artifacts/generation-debug/310f4432-ac0e-4631-beb6-e1c764f191ba/226ef9aa72f7de7dae4b'
const shopping=await read('artifacts/component-cuj-qa/generated/shopping.json')
const shoppingSteps=[
 {op:'click',name:'选择 书',requirement:'R1',expect:{derived:{total:30,left:70}}},
 {op:'click',name:'选择 耳机',requirement:'R2',expect:{derived:{total:110,left:-10},controls:[{name:'确认购买',enabled:false}]}},
 {op:'click',name:'取消全部'},
 {op:'click',name:'选择 杯子',requirement:'R2',expect:{derived:{total:20},controls:[{name:'确认购买',enabled:true}]}},
 {op:'click',name:'确认购买',requirement:'R3',expect:{text:'本次所选',state:{confirmed:true}}},
 {op:'click',name:'返回修改',requirement:'R3',expect:{state:{confirmed:false},derived:{total:20}}},
 {op:'reload',requirement:'R4',expect:{derived:{total:20}}},
]
const shoppingWrong=structuredClone(shoppingSteps);shoppingWrong[5].expect.state.confirmed=true
const cases=[
 {id:'motion',provenance:'Replay of actual model-authored contradictory tests, unchanged original generated source',source:await readFile(motionRoot+'/candidate.cardspec','utf8'),steps:(await read(motionRoot+'/test-1.json')).steps,wrong:(await read(motionRoot+'/test-2.json')).steps,renderMode:'hybrid',goal:'修改速度联动位移；查看解释并返回；刷新恢复速度'},
 {id:'shopping',provenance:'Actual generated source; independently authored shopping path plus deliberately injected wrong return expectation',source:shopping.source,steps:shoppingSteps,wrong:shoppingWrong,renderMode:'native',goal:'多选计算合计；超预算不能确认；查看明细并返回；刷新恢复选择'},
 {id:'kilimanjaro',provenance:'Actual generated source; independent route-days consistency invariant, deliberately NOT repaired or weakened',source:await readFile('artifacts/recent-card-review/3.cardspec','utf8'),steps:[{op:'check',requirement:'R1',expect:{relations:[{left:'derived.plan.length',op:'eq',right:'derived.cur.days'}]}}],wrong:[{op:'click',name:'选这条',index:2,requirement:'R1',expect:{relations:[{left:'derived.plan.length',op:'eq',right:'derived.cur.days'}]}}],renderMode:'hybrid',goal:'选择路线后日程与路线天数一致'},
]
for(const c of cases){
 if(selected&&selected!==c.id)continue
 let run=0;const started=Date.now(),directory=root+'/'+c.id
 await mkdir(directory,{recursive:true});await writeFile(directory+'/source.cardspec',c.source)
 const runner=async(spec,options)=>runDebugBrowser(spec,{...options,scenarios:['normal'],viewports:[432,320],size:'full',captureSteps:true,artifactDir:`${directory}/browser-${++run}`})
 const d=createDebugSession({context:()=>({renderMode:c.renderMode,expressionDialect:'js-v1',cardSize:'full',userGoal:c.goal}),runner,artifactRoot:root+'/debug',cardId:c.id})
 const good=await d.test({source:c.source,steps:c.steps}),bad=await d.test({source:c.source,steps:c.wrong})
 console.log(JSON.stringify({case:c.id,phase:'classified',first:good.status,bad:bad.status,lane:bad.repairLane,conflicts:bad.summary?.testConflicts}))
 let corrected,commit,blocked=false
 if(c.id!=='kilimanjaro'){
  const revision=d.snapshot().tests.at(-1).testOracle.pending[0]?.corrected
  if(revision){await writeFile(directory+'/corrected-steps.json',JSON.stringify(revision,null,2));corrected=await d.test({source:c.source,steps:revision});try{commit=d.commit({version:corrected.version})}catch(e){commit={error:e.message}}}
 }else{try{d.commit({version:bad.version})}catch{blocked=true}}
 const snapshot=d.snapshot();await writeFile(directory+'/trace.json',JSON.stringify(snapshot,null,2))
 const evidenceMatched=c.id==='kilimanjaro'?good.status!=='failed'&&bad.status==='failed'&&bad.repairLane==='behavior-review'&&blocked:good.status!=='failed'&&bad.repairLane==='test'&&corrected?.status!=='failed'&&commit?.source===c.source&&snapshot.repairs===0
 const outcome={id:c.id,provenance:c.provenance,sourceHash:createHash('sha256').update(c.source).digest('hex'),elapsedMs:Date.now()-started,browserRuns:run,first:good.status,bad:bad.status,repairLane:bad.repairLane,conflicts:bad.summary?.testConflicts,corrected:corrected?.status,commit:commit?{status:commit.status,error:commit.error}:undefined,blocked,codeRepairs:snapshot.repairs,evidenceMatched}
 results.push(outcome);console.log(JSON.stringify(outcome));await writeFile(root+'/results.json',JSON.stringify(results,null,2))
}
if(results.some(r=>!r.evidenceMatched))process.exitCode=1
