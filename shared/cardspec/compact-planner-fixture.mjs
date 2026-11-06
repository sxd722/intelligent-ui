import {compileCard} from './compiler.mjs'
// Deterministic transport: this lab scenario never invokes CLI or GLM.
const places=Array.from({length:6},(_,i)=>({id:`p${i+1}`,name:['湖畔散步','科学探索','小小农场','森林观察','室内手作','城市公园'][i],lat:30.13+i*.015,lon:120.21+i%2*.02,img:'nature park',tag:'一段轻松的探索体验',price:i%2?'¥30':'免费'}))
export const COMPACT_PLANNER=`<card actionMode="snapshot"><data id="places" value={${JSON.stringify(places)}}/>
<state id="budget" type="number" initial={200}/><state id="chosen" type="array" initial={[]}/><state id="focus" type="string" initial=""/>
<binding id="plan" tool="glm.generate" load="manual" input={{"prompt":"按偏好整理选择","context":{"budget":state.budget,"ids":state.chosen}}}/>
<title>周末探索 · 测试数据</title><caption>示例仅用于验证选择与恢复。</caption>
<row><input label="预算" inputType="number" value={state.budget} onChange="budget"/></row>
<map items={data.places} selectedId={state.focus} onSelect="focus"/>
<region overflow="scroll"><each items={data.places} as="place" itemKey={place.id}><row><image query={place.img} alt={place.name} mediaRole="thumbnail" size="small"/><stack><strong>{place.name}</strong><caption>{place.price}</caption></stack><button label="选入" variant={includes(state.chosen,place.id) ? "primary" : "quiet"} onPress="choose" args={place}/></row></each></region>
<region role="actions"><text>已选 {count(state.chosen)} 项</text><button onPress="plan" disabled={count(state.chosen)==0}>生成测试方案</button></region>
<action id="budget"><set target="budget" value={event.value}/></action><action id="focus"><set target="focus" value={event.id}/></action>
<action id="choose"><set target="chosen" when={includes(state.chosen,args.id)} value={filter(state.chosen,item!=args.id)}/><append target="chosen" when={!includes(state.chosen,args.id)} value={args.id}/><set target="focus" value={args.id}/></action>
<action id="plan"><invoke binding="plan" target="page"/></action></card>`
export async function compactPlannerTransport(payload){
 const context=payload.input.context
 const source=`<card><title>按选择整理 · 工具替身</title><text>预算 ${Number(context.budget)} · 已选 ${context.ids.length} 项</text><collection items={${JSON.stringify(places.filter(p=>context.ids.includes(p.id)))}} fields={["price","tag"]} detailMode="external"/><region><title>下一步</title><text>返回后修改预算与选择，再次提交验证输入快照。</text></region></card>`
 return {kind:'page',spec:compileCard(source,{final:true,cardId:'compact-result-'+Date.now()}).spec,resources:{}}
}
