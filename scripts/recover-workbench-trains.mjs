// Explicit experimental recovery, not a production or model-success patch.
import {readFile,writeFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {resolveCardResources} from '../server/cardspec/resources.mjs'
import {createCardSession} from '../src/cardspec/tool-session.mjs'
import assert from 'node:assert/strict'
const root='artifacts/rsi-2026-10-16',data=JSON.parse(await readFile('public/workbench/data.json','utf8')),record=data.records.find(r=>r.id==='08-trains'&&r.format==='cardspec'),original=JSON.parse(await readFile(root+'/08-trains-cardspec.json','utf8'))
const edits=[
 ['<set target="dir" value={event.value}/>','<set target="dir" value={args.dir ?? event.value}/>'],
 ['<action id="pick"><set target="picked" key={args.id} value={true}/><set target="picks" value={state.picks + [args]}/>','<action id="pick"><set target="picked" key={args.id} value={!(state.picked[args.id] ?? false)}/><append target="picks" value={args} when={!(state.picked[args.id] ?? false)}/><remove target="picks" key={args.id} when={state.picked[args.id] ?? false}/>'],
 ['onPress={state.picked[train.rowKey]?"unpick":"pick"}','onPress="pick"'],
 ['onPress={state.dir=="out"?"refreshOut":"refreshBack"}','onPress="refresh"'],
 ['</card>','<action id="refresh"><invoke binding="outTrains" when={state.dir=="out"}/><invoke binding="backTrains" when={state.dir=="back"}/></action></card>'],
 ['<set target="note" value={"已加入清单："+args.code+" "+args.time+" "+args.route}/>','<set target="note" value={state.picked[args.id]?"已从清单移除":"已加入清单："+args.code+" "+args.time+" "+args.route}/>'],
 ['已实时查询12306：','通过12306查询：'],
 ['余票为查询时刻快照（去程155趟/返程365趟中当前检索窗口返回1趟），仅供参考；','余票为本次查询快照，仅供参考；']
]
let source=record.source
for(const [from,to]of edits){assert.ok(source.includes(from),'Expected recovery fragment: '+from);source=source.replace(from,to)}
const result=compileCard(source,{final:true,cardId:'rsi-trains-host-recovery',context:{localDate:'2026-10-16',timeZone:'Asia/Shanghai',cardSize:'square',userGoal:'周五杭州去上海和周日上海回杭州的订票助手'}})
assert.equal(result.complete,true,JSON.stringify(result.diagnostics))
const session=createCardSession(result.spec,{transport:async()=>({kind:'json',value:{items:[],source:'test',fetchedAt:new Date().toISOString(),truncated:false}})})
session.fire('setDir',{args:{dir:'back'}});assert.equal(session.current().store.values.dir,'back')
session.fire('setDir',{event:{value:'out'}});assert.equal(session.current().store.values.dir,'out')
const args={id:'train-test',code:'TEST',time:'12–13',route:'A→B'};session.fire('pick',{args});assert.equal(session.current().store.values.picks.length,1);session.fire('pick',{args});assert.equal(session.current().store.values.picks.length,0);session.dispose()
const resources=await resolveCardResources(result.spec,async(query,signal,role)=>{const res=await fetch('http://127.0.0.1:8787/api/photo?'+new URLSearchParams({query,role}),{signal});if(!res.ok)return null;const v=await res.json();return {...v,content:v.url}},AbortSignal.timeout(25000))
const file='08-trains-cardspec-before-host-repair.json';for(const folder of [root,'public/workbench','dist/workbench'])await writeFile(folder+'/'+file,JSON.stringify(original,null,2))
record.priorAttempts=[...(record.priorAttempts||[]),{status:record.status,error:record.error,elapsedMs:record.elapsedMs,trace:'/workbench/'+file}]
Object.assign(record,{status:'succeeded',hostRepaired:true,modelStatus:'failed',error:undefined,source,spec:result.spec,resources,deck:undefined,trace:'/workbench/08-trains-host-repair.json'})
for(const folder of [root,'public/workbench','dist/workbench'])await writeFile(folder+'/08-trains-host-repair.json',JSON.stringify({record,edits,diagnostics:result.diagnostics,checks:['direction button and segmented event','select/unselect transaction'],notice:'Host-corrected preview; all three original model generations failed. Exclude this preview from model success rate.'},null,2))
for(const folder of ['public/workbench','dist/workbench'])await writeFile(folder+'/data.json',JSON.stringify(data,null,2))
console.log('Host recovery compiled and transaction checks passed; original failures preserved.')
