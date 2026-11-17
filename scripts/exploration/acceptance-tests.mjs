import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateFrozenTask,resolveSemantic,proposeSteps,frozenOracle,sha256,frozenTasks,recordingEligibility,allocationTotals,transferSteps} from './acceptance.mjs'

test('frozen expected results agree with independently implemented arithmetic',async()=>{
 const tasks=await frozenTasks(),a=tasks[0].data,b=tasks[1].data,c=tasks[2].data
 assert.deepEqual(recordingEligibility(a.kits,a.initialNeeds),{eligible:['reed'],unknown:['moss'],ineligible:['owl','stone']})
 assert.deepEqual(recordingEligibility(a.kits,{...a.initialNeeds,minBatteryHours:6}),{eligible:['reed','stone'],unknown:['moss'],ineligible:['owl']})
 assert.deepEqual(allocationTotals(b.machines,b.jobs,{poster:'pine',leaflet:'cedar',ticket:'cedar'}),{loads:{pine:45,cedar:65},remaining:{pine:15,cedar:5},overrun:{pine:0,cedar:0}})
 assert.deepEqual(allocationTotals(b.machines,b.jobs,{poster:'cedar',leaflet:'pine',ticket:'cedar'}),{loads:{pine:35,cedar:75},remaining:{pine:25,cedar:0},overrun:{pine:0,cedar:5}})
 assert.deepEqual(transferSteps(c.initial,5,4),{sourceL:40,receiverL:40,totalL:80})
 assert.deepEqual(transferSteps(c.initial,10,7),{sourceL:0,receiverL:80,totalL:80})
})

test('semantic paths tolerate different state owners, but ambiguous meanings stay unverified',()=>{
 assert.equal(resolveSemantic({componentState:{water:{logic:{sourceL:40}}}},'sourceL').value,40)
 assert.equal(resolveSemantic({state:{sourceL:40},derived:{sourceL:30}},'sourceL').found,false)
 assert.equal(resolveSemantic({state:{arbitrary:40}},'sourceL',{sourceL:'state.arbitrary'}).value,40)
})

test('clicks and changed state alone cannot pass an independent business task',async()=>{
 const result=await evaluateFrozenTask({taskId:'screen-02-print-room',source:'immutable',spec:{},browser:{status:'tested',runs:[{scenario:'normal',path:'resolve-overrun',width:432,initial:{},final:{state:{count:1}},actions:[{ok:true,changed:true,step:{op:'click',name:'安排'}}]}]}})
 assert.notEqual(result.status,'passed')
 assert.ok(result.checks.some(c=>c.id==='resolve-overrun-loads-pine'&&c.status==='unverified'))
})

test('wrong arithmetic fails even when restore and clicks succeed',async()=>{
 const result=await evaluateFrozenTask({taskId:'screen-02-print-room',source:'immutable',spec:{},browser:{status:'tested',runs:[{scenario:'normal',path:'resolve-overrun',width:432,initial:{},final:{state:{assignment:{poster:'pine',leaflet:'cedar',ticket:'cedar'}},derived:{loads:{pine:44,cedar:65}}},actions:[{ok:true,restored:true,step:{op:'reload'}}]}]}})
 assert.equal(result.checks.find(c=>c.id==='resolve-overrun-loads-pine').status,'failed')
 assert.equal(result.status,'failed')
})

test('unknown recording-kit battery cannot be silently accepted',async()=>{
 const result=await evaluateFrozenTask({taskId:'screen-01-recording-kit',source:'immutable',spec:{},browser:{status:'tested',runs:[{scenario:'normal',path:'initial-compare',width:432,initial:{derived:{eligibleIds:['reed','moss'],unknownIds:[]}},final:{},actions:[]}]}})
 assert.equal(result.checks.find(c=>c.id==='initial-eligible').status,'failed')
 assert.equal(result.checks.find(c=>c.id==='initial-unknown').status,'failed')
})

test('frozen water arithmetic and both branch outcomes can be evaluated without fixed node IDs',async()=>{
 const oracle=await frozenOracle('screen-03-water-transfer')
 const states=[{sourceL:40,receiverL:40,elapsedSeconds:4,running:false,rateLPerSecond:5,graphicVolumes:[40,40]},{sourceL:0,receiverL:80,running:false,rateLPerSecond:10,graphicVolumes:[0,80]}]
 const runs=oracle.paths.map((p,i)=>({scenario:'normal',path:p.id,width:432,initial:{},final:{componentState:{'random-module-name':{logic:states[i]}}},actions:i===0?[{step:{op:'check',waitMs:2200},observed:{state:{sourceL:40}}},{step:{op:'reload'},ok:true,restored:true}]:[]}))
 const operationLog=oracle.paths.flatMap(p=>p.operations.map(o=>({path:p.id,intent:o.intent,executed:true,evidenceRef:p.id+'/'+o.intent})))
 const graphicObservations=oracle.paths.map((p,i)=>({path:p.id,artifactHash:sha256('immutable'),method:'svg-dom',evidenceRef:'self-test-fixture/'+p.id,volumes:states[i].graphicVolumes}))
 const r=await evaluateFrozenTask({taskId:'screen-03-water-transfer',source:'immutable',spec:{},browser:{status:'tested',runs},run:{operationLog,graphicObservations}})
 assert.equal(r.businessStatus,'passed')
 assert.equal(r.layoutStatus,'unverified')
 assert.equal(r.status,'partial')
 assert.ok(r.checks.filter(c=>c.id.endsWith('conservation')).every(c=>c.status==='passed'))
})

test('a plot merely existing is not graphic-business linkage proof',async()=>{
 const r=await evaluateFrozenTask({taskId:'screen-03-water-transfer',source:'immutable',spec:{},browser:{status:'tested',runs:[{scenario:'normal',path:'step-pause-restore',width:432,initial:{},final:{state:{sourceL:40,receiverL:40},visualCount:1},actions:[]}]}})
 assert.equal(r.checks.find(c=>c.id==='step-pause-restore-graphic-business-link').status,'unverified')
})

test('even an exact business-state copy named graphicVolumes is not independent visual evidence',async()=>{
 const r=await evaluateFrozenTask({taskId:'screen-03-water-transfer',source:'immutable',spec:{},browser:{status:'tested',runs:[{scenario:'normal',path:'step-pause-restore',width:432,initial:{},final:{state:{sourceL:40,receiverL:40,graphicVolumes:[40,40]},visualCount:1},actions:[]}]},semanticMapping:{graphicVolumes:'state.graphicVolumes'}})
 assert.equal(r.checks.find(c=>c.id==='step-pause-restore-graphic-business-link').status,'unverified')
})

test('discovery refuses ambiguous controls and does not invent hidden return buttons',()=>{
 const r=proposeSteps('screen-03-water-transfer',[{role:'button',name:'单步 A'},{role:'button',name:'单步 B'}])
 assert.equal(r.steps.length,0)
 assert.ok(r.unresolved.length)
})

test('layout is a whole-card gate and cannot be hidden by other passing checks',async()=>{
 const r=await evaluateFrozenTask({taskId:'screen-02-print-room',source:'immutable',spec:{},browser:{status:'tested',runs:[{scenario:'normal',path:'resolve-overrun',width:432,initial:{layout:{issues:[]}},final:{layout:{issues:[{code:'internal-overflow',allowed:false,decorativeOnly:false,overflow:87}]}},actions:[]}]}})
 assert.equal(r.layoutStatus,'failed')
 assert.equal(r.status,'failed')
})
