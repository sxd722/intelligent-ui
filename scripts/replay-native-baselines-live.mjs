import {readFile,writeFile} from 'node:fs/promises'
import {getQuickJS} from 'quickjs-emscripten'
import {executeLogic} from '../shared/cardspec/logic-engine.mjs'
import {SOURCES,SEEDS,FAMILY_SCHEMA} from '../shared/cardspec/baselines/logic.mjs'
import {validateLogicView} from '../shared/cardspec/logic-view.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {BASELINE_CARDS} from '../shared/cardspec/baselines/cards.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'
import assert from 'node:assert/strict'
const q=await getQuickJS(),out=[];
for(const id of ['sentiment','family','movies','trains']){
 const saved=JSON.parse(await readFile('artifacts/native-baselines/live/'+id+'-session.json','utf8')),bindings=saved.pages[0].bindings;
 const compiled=compileCard(BASELINE_CARDS.find(x=>x.id===id).source,{final:true,context:{localDate:'2026-10-20'}}),node=compiled.spec.children.find(x=>x.type==='logic'),scope=makeScope(compiled.spec,createStore());
 let state=structuredClone(SEEDS[id]),response={seq:0},seq=0;
 const run=(type,args={})=>{state=executeLogic(q,{source:SOURCES[id],state,event:{type,args:{},...args},input:{response,today:'2026-10-20',planSchema:FAMILY_SCHEMA}});validateLogicView(node.children,{...scope,local:state});};
 const reply=op=>{const b=bindings[op];response={seq:++seq,op,ok:b.status==='success',value:b.value,input:b.retry.input,error:b.error};run('input');};
 run('init');
 if(id==='sentiment'){reply('news');reply('videos');run('select',{item:state.sources.videos.items[0]});run('comments');reply('comments');assert.equal(state.total,3);run('analyze');reply('analyze');assert.equal(state.labels.length,0);assert.match(state.message,/失败/);}
 if(id==='family'){reply('search');for(const item of state.rows.slice(0,2)){run('focus',{item});run('toggle');}run('plan');reply('plan');assert.equal(state.plan.slots.length,2);}
 if(id==='movies'){reply('search');run('select',{item:state.rows[0]});run('detail');reply('detail');assert.match(state.message,/资料已更新/);run('choose');run('videos');reply('videos');assert.ok(state.videos.length);assert.ok(state.pick.assetRef);}
 if(id==='trains'){reply('search');run('select',{item:state.rows[0]});run('pin');assert.ok(state.tickets[0].train_no);}
 out.push({id,passed:true,kind:'recorded real tool data replay; no new external requests',message:state.message});
}
await writeFile('artifacts/native-baselines/live/replay.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
