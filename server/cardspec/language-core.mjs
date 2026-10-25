import {FUNCTION_NAMES} from '../../shared/cardspec/expression.mjs'

const JS_DECLARATIONS=`【JavaScript表达式】CardSpec标签保持不变，{...}内使用纯JavaScript表达式。宿主已选择js-v1，无需写版本属性。
data.x是常量、state.x是状态、derived.x是派生值；声明放card最前。唯一的声明id也可直接当变量读取，如total等价derived.total；裸状态名遵守state快照语义。回调和each局部变量优先，重名声明必须加前缀。state类型number|string|boolean|array|record。属性字符串不插值，动态值写label={表达式}。
<data id="items" value={[{id:"a",label:"示例",price:3}]}/><state id="qty" type="record" initial={{}}/><derive id="total" value={data.items.reduce((sum,row)=>sum+row.price*(state.qty[row.id]??0),0)}/>
支持Math的常用纯数学函数，Number/String/Boolean转换，Number.isFinite/isInteger/isNaN，Object.keys/values/entries/fromEntries，Array.isArray；数组filter/map/find/some/every/findIndex/reduce（reduce显式初值），回调用表达式箭头；includes/indexOf/slice/concat/at/join；字符串trim/toLowerCase/toUpperCase/startsWith/endsWith/split/replace/replaceAll；数字toFixed。支持?.、??、模板字符串、对象/数组展开。缺失值是undefined，find无匹配用??兜底；状态/工具输入提交为有限JSON：对象中undefined字段自动省略，根值或数组项不能是undefined，NaN/Infinity报错。不支持赋值、动态方法、sort、正则、任意函数调用或异步；多步计算用logic里的同步JS update。
日期和格式保留少量宿主函数：range(n)、clamp(n,min,max)、formatNumber(n,2)、dateKey、monthOf、dayOf、addDays、addMonths、formatDate(value,context.timeZone,"yyyy-MM-dd")。context.localDate为当天；不是实时钟。普通组件事件仍引用action ID，不写内联JS。
columns/span等数字属性写columns={2}。集合处理使用命名回调参数，不用旧的隐式item谓词语法。args可传有限JSON（如args={0}直接读args，或args={{id:"a"}}读args.id）；event.args与args等价，均为显式参数；事件自身的值仍读event.value/checked。
子节点也可用{rows.map(row=><text key={row.id}>{row.name}</text>)}与条件&&/三元渲染，编译为原生each/if；if.test和action.when按JavaScript真假值判断。map只接受一个命名参数且根节点必须有稳定key，仅限已注册组件，不是任意HTML/React执行。
logic的update先应用本次event，再用更新后的状态统一计算显示结果，避免输入已经改变而计算落后一拍。reactive={true}时initial只需输入/选择等种子状态，派生矩阵和显示字段在update中统一算出，不写重复的零值占位；宿主先运行init并验证视图，再显示，恢复时保留已有选择。
复杂本地逻辑使用<logic id="counterLogic" initial={{n:0}} source={\`function update(state,event,input) { if(event.type === "add") state.n++; return state; }\`}><stat label="数量" value={local.n}/><button onPress="add">增加</button></logic>。source可用无插值的多行模板字符串，减少转义；它是隔离JS，不访问网络/DOM，只返回完整有限JSON状态；local读取该模块状态，外部action不能直接修改local。`

export const CARD_LANGUAGE_CORE=`【声明与计算】声明放card最前，id唯一固定字面量。
<data id="items" value={[{id:"a",label:"示例",price:3}]}/><state id="qty" type="record" initial={{}}/><derive id="total" value={sum(data.items,item.price*(state.qty[item.id]??0))}/>
声明各自的读取空间严格对应：data.x、state.x、derived.x，不混用；action是card直接子节点，在</card>前定义所有引用的动作。state类型number|string|boolean|array|record。表达式可用data/state/next/derived/context、event/args、item/index、[]访问、算术比较、逻辑、三元、数组/对象。只允许函数：${FUNCTION_NAMES.join(', ')}。不能调用JS方法或箭头函数；复杂数值与聚合用logic中的JS，普通表单用action。
filter/find/map/count/sum第二参数用item/index表达式，例如filter(data.items,item.price>0)、map(data.items,item.id)、count(data.items,state.qty[item.id]>0)。内层item覆盖外层item，each用as="entry"保留外层。find无匹配返回null，提供??兜底。len仅一个参数。金额用formatNumber(n,2)，round返回数字。context.localDate是当天日期，monthOf得到YYYY-MM；formatDate(value,context.timeZone,"yyyy-MM-dd")。不把context.generatedAt当实时钟。
columns/span是1–12的整数，写columns={2}。表达式相等用==或===，不用单独=；字符串搜索includes(state.query,"词")，不能调用.includes/.filter等JS方法。属性引号内没有插值：label={"数量 "+state.n}；text子内容可写{text表达式}。字符串用ASCII引号，\n用JSON转义。无展开语法、任意方法或HTML。
【事务动作】<action id="add"><increment target="n" value={1}/></action>。支持set/toggle/increment/append/update/remove；set可key={键}更新record，update/remove按数组对象id查找key。条件写在步骤属性，例如<set target="n" value={state.n-1} when={state.n>0}/>；不存在<when>标签。if仅用于视图，不嵌套action。
新卡actionMode="snapshot"：state与derived固定为动作入口；next读取之前步骤的新值。先扣费再判终局用next；恢复固定额度用set而非increment。所有步骤全部通过才提交，失败不执行工具。保存历史需set物化明细与总额后再清空，历史不得读取实时表单。
事件来自组件契约。button没有自动id/value，条目用args={item}传入并读args.id；input读event.value（number输入返回数字），checkbox读event.checked，segmented读event.value；chart/mindmap/flowchart/collection的onSelect读event.id。例如<action id="pick"><set target="sel" value={event.id}/></action>。calendar选日event.date、换月event.month与event.date同时更新。不能混用args/event。所有on事件指向已声明action，logic内部指局部事件。
每个实际业务操作在同一事务落实代价、效果和次数限制；重复点击需锁定，反馈可读后才推进；按初次/第二次/终局/重开检查，重开恢复全部状态。选择前显示数据中真实代价，不靠disabled代替扣费。不为未要求的任务添加回合增长或假分数。
【集合】<each items={data.items} as="entry" itemKey={entry.id}><button onPress="pick" args={entry}>{entry.label}</button></each>。each模板id可省略，不能动态id；itemKey唯一。字符串数组直接item，不能item.id。<if test={state.n>0}>组件</if>，无else；另一个if表达反向条件。多步视图共享同一实体与选择，不复制不同状态。
复杂流程需保留早期选择时用record，不用每轮覆写的单一flag。选择结算与继续推进分开；最后一轮先显示反馈再结束。保存/删除/切换记录时同步加载全部草稿。保存工具结果时一并物化名称、数量和当次条件；已保存视图不再依赖可编辑草稿来解释ID。
禁止onclick或任意DOM事件处理源码。
【可运行短例】<intro>记录进度。</intro><card actionMode="snapshot"><state id="n" type="number" initial={0}/><stat label="已记录" value={state.n}/><button onPress="add">增加</button><action id="add"><increment target="n"/></action></card><outro>点击增加。</outro>`

export const CARD_JS_LANGUAGE_CORE=JS_DECLARATIONS+`
【事务动作】用set提交纯JS计算结果，target是state id；key仅用于record字段。数组直接用展开/filter/map，按真实身份字段比较，不依赖隐藏的id匹配规则。
<action id="remove"><set target="chosen" value={state.chosen.filter(row=>row.rowKey!==args.rowKey)}/></action>
<action id="add"><set target="n" value={state.n+1} when={state.n<10}/></action>
when=false跳过该步骤；if仅用于视图，action为card直接子节点。复杂多步计算优先logic的update函数。
`+CARD_LANGUAGE_CORE.slice(CARD_LANGUAGE_CORE.indexOf('新卡actionMode=')).replace('<increment target="n"/>','<set target="n" value={state.n+1}/>')

