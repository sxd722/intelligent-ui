import {readFile,writeFile} from 'node:fs/promises'
import {createStore,makeScope,executeAction} from '../shared/cardspec/store.mjs'
const dir='artifacts/recent-card-review',out=[]
const specs=await Promise.all([0,1,2,3,4].map(i=>readFile(`${dir}/${i}-spec.json`,'utf8').then(JSON.parse)))
const test=(spec)=>{const store=createStore();makeScope(spec,store);return {store,scope:()=>makeScope(spec,store),fire:(id,extra={})=>executeAction(spec,store,id,extra)}}
const game=test(specs[0]);const start=structuredClone(game.store.values)
game.fire('addCard',{args:{id:'c1'}});game.fire('advance')
out.push({case:0,check:'非法组合不消耗',expected:'金钱和行动次数不变',before:{money:start.money,acts:start.acts},actual:{...game.store.values}})
game.fire('restart')
for(let i=0;i<2;i++){game.fire('addCard',{args:{id:'c1'}});game.fire('addCard',{args:{id:'c2'}});game.fire('advance')}
out.push({case:0,check:'两次合法行动后进入下一阶段',expected:'可继续下一阶段',actual:structuredClone(game.store.values)})
game.fire('advance');out.push({case:0,check:'继续行动',actual:structuredClone(game.store.values)})
game.fire('restart');game.fire('addCard',{args:{id:'c2'}});game.fire('addCard',{args:{id:'c1'}})
out.push({case:0,check:'同类组合交换顺序',expected:'地点+人物不应因放入顺序失效',actual:{types:game.scope().derived.slotTypes,match:game.scope().derived.match}})
const mountain=test(specs[3]);for(const r of mountain.scope().data.routes){mountain.fire('setRoute',{args:r});const scope=mountain.scope();out.push({case:3,check:'路线与日程一致',route:r.id,expected:r.days,actual:scope.derived.plan.length,firstDay:scope.derived.plan[0].t})}
const ai=test(specs[4]);for(const id of ['capex','revenue','funding'])ai.fire('togglePick',{args:{id}});ai.fire('togglePick',{args:{id:'capex'}})
out.push({case:4,check:'只选一个升温信号的解释',actual:{picked:ai.store.values.picked,heatScore:ai.scope().derived.heatScore,verdict:ai.scope().derived.verdict}})
const mall=test(specs[2]);mall.fire('toggleOpen',{args:{id:'jinlimen'}});mall.fire('setCat',{event:{value:'服饰'}});mall.fire('setCat',{event:{value:'全部'}})
out.push({case:2,check:'切换分类再返回保留已展开项',expected:'jinlimen',actual:mall.store.values.openId})
const inventory=specs.map((spec,i)=>{const counts={};function walk(nodes){for(const n of nodes||[]){counts[n.type]=(counts[n.type]||0)+1;walk(n.children)}}walk(spec.children);return {case:i,model:spec.context.modelProfile,size:spec.context.cardSize,design:spec.design||'default',visualStyle:spec.visualStyle,counts,bindings:Object.values(spec.bindings).map(b=>({tool:b.tool,load:b.load})),research:(spec.research?.trace||[]).filter(t=>t.type==='research'&&t.status!=='running').map(t=>({tool:t.tool,status:t.status,input:t.input})),debug:spec.generationDebug,diagnostics:spec.experienceDiagnostics}})
await writeFile(dir+'/semantic-checks.json',JSON.stringify(out,null,2));await writeFile(dir+'/inventory.json',JSON.stringify(inventory,null,2))
console.log(JSON.stringify(out,null,2))
