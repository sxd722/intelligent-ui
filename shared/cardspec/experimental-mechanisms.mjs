// S2 material: mechanically tested examples, not task templates or new runtime APIs.
export const MECHANISM_REVISION='mechanisms-v1'
export const MECHANISMS=Object.freeze([
 {
  id:'inspect-return',intent:'选择对象、查看新详情、返回并保留实体身份',stateOwner:'existing CardSpec store',
  notFor:'无需选择或详情的单一确定答案；此例不提供业务ID推断或工具数据',
  counterexample:'点击乙只改selected，而详情仍固定读取records[0]；返回时清空selected。',
  source:`<card schemaVersion="1" actionMode="snapshot">
<data id="records" value={[{id:"a",label:"织纹",note:"细线交错"},{id:"b",label:"颗粒",note:"圆点疏密"}]}/>
<state id="selected" type="string" initial="a"/><state id="detail" type="boolean" initial={false}/>
<derive id="current" value={data.records.find(item=>item.id===state.selected)}/>
<if test={!state.detail}><each items={data.records} as="item" itemKey={item.id}><button onPress="open" args={{id:item.id}}>{item.label}</button></each></if>
<if test={state.detail}><title>{derived.current.label}</title><text>{derived.current.note}</text><button onPress="back">返回</button></if>
<action id="open"><set target="selected" value={args.id}/><set target="detail" value={true}/></action>
<action id="back"><set target="detail" value={false}/></action></card>`
 },
 {
  id:'snapshot-next',intent:'一次动作内先写状态，再按新值更新结果',stateOwner:'existing CardSpec snapshot transaction',
  notFor:'此例不包含业务分配器、物理求解器或新的时钟；异步结果须开启新事务。',
  counterexample:'先increment n，再以state.n计算doubled；snapshot读到旧值，导致结果落后一拍。',
  source:`<card schemaVersion="1" actionMode="snapshot">
<state id="n" type="number" initial={2}/><state id="doubled" type="number" initial={4}/>
<button onPress="advance">推进一步</button><text>输入 {state.n}，结果 {state.doubled}</text>
<action id="advance"><increment target="n" value={1}/><set target="doubled" value={next.n*2}/></action></card>`
 }
])

// The first screening round fixes these two examples for every S2 run. No task
// oracle, topical data, or changing retrieval policy is used to pick examples.
export function executableMechanismMaterial({enabled=false}={}){
 if(!enabled)return {revision:null,ids:[],prompt:''}
 return {revision:MECHANISM_REVISION,ids:MECHANISMS.map(x=>x.id),prompt:'以下是同运行时已执行通过的两段机制微例；只迁移动作与数据关系，不复制题材或布局，也不增加用户未要求的功能。\n'+MECHANISMS.map(x=>`${x.id}：${x.intent}。反例：${x.counterexample}\n${x.source}`).join('\n\n')}
}
