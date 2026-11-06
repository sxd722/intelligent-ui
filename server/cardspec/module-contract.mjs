// Small source-file contract. Avoid sending whole-card strategy, tool discovery,
// sandbox authoring and unrelated examples on every native module repair.
export const MODULE_JS_CONTRACT=`本文件使用CardSpec原生标签，不是HTML。属性用引号或{纯JS表达式}。读取data.x/state.x/derived.x/context.datasets；items样本仅展示字段，不抄成真实全量数据。
数组可用filter/map/flatMap/find/some/includes/slice/concat，回调只能表达式箭头，不能{语句块}；reduce必须初值。不使用正则、sort、赋值、异步、任意函数。复杂计算保持多条小derive，不写巨型表达式。缺失值用?.和??，未知不变成0。
声明：<data id="rows" value={context.datasets.D1.items}/><state id="chosen" type="array" initial={[]}/><derive id="count" value={state.chosen.length}/>。仅使用实际存在的dataset。引用interfaces已有声明，不重复。
动作：<action id="pick"><set target="selected" value={args.id}/></action>；button传args={{id:row.id}}；slider/input/segmented取event.value，checkbox取event.checked。多个set按快照执行：state是动作入口，next读取之前步骤的新值。if只放UI，action声明放文件顶层。
条目：<each items={derived.rows} as="row" itemKey={row.id}><text>{row.title}</text></each>。真实图片用<image assetRef={row.assetRef} alt={row.title} mediaRole="thumbnail"/>，query仅示意检索词，不放URL。一个视图导航由main负责，不在每个片段重复按钮。`
export function moduleContract(core,{javascript,fragment}){
 return javascript?MODULE_JS_CONTRACT+(fragment?'\n本文件没有card根，直接写组件与专属声明；宿主链接声明。':'\n根只写<card schemaVersion="1" actionMode="snapshot">，标题用title子组件；尺寸来自宿主，不写card.title/card.size。'):core
}
