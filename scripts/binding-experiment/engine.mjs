import {CASES,roles,normalize,envelope,detailInput,schemaFor} from './cases.mjs'
import {TOOLS,validateToolInput} from '../../shared/cardspec/tools.mjs'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {registryReference} from '../../shared/cardspec/registry.mjs'
import {createCardSession} from '../../src/cardspec/tool-session.mjs'
import {evaluate} from '../../shared/cardspec/expression.mjs'
export {CASES,normalize}
export const MODEL='deepseek-v4-flash'
export const hashInput=x=>JSON.stringify(x)
export function checkMapping(c,map){const fields=new Set(schemaFor(c).map(f=>f.name));for(const [role,path]of Object.entries(map)){if(!Object.hasOwn(roles,role)||path!==null&&!fields.has(path))throw Error('Unknown mapping '+role+':'+path);if(role==='metric'&&path&&c.rows.some(r=>r[path]!=null&&typeof r[path]!=='number'))throw Error('Metric must be numeric')}return map}
export function mappingScore(c,map){return Object.keys(roles).map(role=>({role,expected:c.map[role]||null,actual:map[role]||null,pass:(c.map[role]||null)===(map[role]||null),critical:role==='id'||role==='metric'}))}
export function autoPrelude(c){
 if(c.static)return ''
 if(c.write)return `<binding id="feed" tool="${c.tool}" input={{}} load="manual"/><action id="pause"><invoke binding="feed"/></action>`
 const fixed=JSON.stringify(c.input)
 const inp=c.detail?JSON.stringify(c.detail.fixed||{}).replace(/}$/,`${Object.keys(c.detail.fixed||{}).length?',':''}${JSON.stringify(c.detail.param)}:state.selected.id}`):''
 return `<binding id="feed" tool="${c.tool}" input={${fixed}} load="visible"/>
<state id="query" type="string" initial=""/><state id="selected" type="record" initial={{}}/><state id="chosen" type="array" initial={[]}/><state id="detailOpen" type="boolean" initial={false}/>
<derive id="rows" value={bindings.feed.value.items.filter(r=>String(r.title ?? "").includes(state.query))}/>
<action id="filter"><set target="query" value={event.value}/></action><action id="select"><set target="selected" value={event.item}/><set target="detailOpen" value={false}/></action>
<action id="compare"><set target="chosen" value={state.chosen.some(r=>r.id===state.selected.id)?state.chosen.filter(r=>r.id!==state.selected.id):state.chosen.concat([state.selected])}/></action>
<action id="back"><set target="detailOpen" value={false}/></action><action id="refresh"><invoke binding="feed"/></action>
${c.detail?`<binding id="detail" tool="${c.detail.tool}" input={{}} load="manual"/><action id="detail"><set target="detailOpen" value={true}/><invoke binding="detail" input={${inp}}/></action>`:''}`
}
// String() is deliberately avoided: the supported JS dialect has no arbitrary global calls.
export function expand(c,arm,source){return ['A2','A3','A4'].includes(arm)?source.replace(/(<card\b[^>]*>)/,(_,open)=>open+autoPrelude(c).replace('String(r.title ?? "")','(r.title ?? "")')):source}
export const componentNames=['collection','experience','title','text','caption','strong','button','row','stack','box','grid','region','stat','stats','input','segmented','chart','image','if','each','badge','progress','slider','tool-view']
export function messagesFor(c,arm,map){
 const auto=['A2','A3','A4'].includes(arm),raw=arm==='A0',rows=raw?c.rows:normalize(c.rows,map)
 const system=`生成一张原生CardSpec v1卡片，只输出完整<card>源码，无Markdown围栏。表达式为js-v1，可用数组filter/find/map/some、字符串includes、??与可选链，不能调用未注册全局函数。根schemaVersion="1"，actionMode="snapshot"。<data id="x" value={...}/>，<state id="x" type="string|number|boolean|array|record" initial={...}/>，<derive id="x" value={...}/>；<action id="a"><set target="x" value={event.value}/><invoke binding="b" input={...}/></action>，state/derived是动作入口值，next为新值。<binding id="b" tool="实际ID" input={...} load="visible|manual"/>，bindings.b.value.items/status/error，响应更新binding。编译不调用工具；写操作必须manual。条件用<if test={...}>；每个节点可有id。原生无CSS、style对象。保持关键信息紧凑清晰，在432方形和320手机可用，图表仅使用真实数值，简单任务不凑组件。可用design="business|pearl|atlas|academy|rebel|default"和surface="bare"。不要添加图片URL，图片源本轮不可用则保留文字识别。\n${registryReference({compact:true,names:componentNames})}`
 let contract
 if(auto){contract=`宿主会在根内注入数据/动作，不要重定义它们。可自由设计UI，无须写binding：\n${c.static?'无需注入，自己写本地状态。':c.write?'bindings.feed.value.items 是执行回执；按钮onPress="pause"触发。':'derived.rows为标题搜索后的数组；state.query、state.selected（完整行）、state.chosen（比较行数组）、state.detailOpen已存在。输入onChange="filter"；collection onSelect="select"；按钮onPress="refresh"刷新；'+(c.compare?'onPress="compare"加入/移出比较。':'')+(c.detail?'onPress="detail"查询真实ID详情，bindings.detail.value.items[0].body是新增详情，onPress="back"返回。':'')}`}
 else contract=c.static?'无工具。':JSON.stringify({tools:[c.tool,...(c.detail?[c.detail.tool]:[])].map(id=>({id,input:TOOLS[id]?.inputSchema,output:raw?TOOLS[id]?.columns:['id','title','subtitle','metric','facet','raw'],readOnly:TOOLS[id]?.readOnly})),input:c.input,detail:c.detail?{inputFromSelectedRow:{[c.detail.param]:raw?c.map.id:'id'},fixed:c.detail.fixed||{},resultSample:raw?c.details(c.rows[0][c.map.id]):envelope([{body:'新增详情正文'}])}:null})
 const acceptance=c.static?'必须有label="切换颜色"的按钮，并以文字显示当前颜色。':c.write?'必须有label="暂停"的按钮，执行前不要声称已暂停；点击后显示回执。':`必须有label="筛选"的input作标题搜索；collection显示候选并可选择，选中项有可见文字反馈。按钮文字或label="刷新"。${c.detail?'按钮label="查看详情"发起新增取数；展示实际返回信息；label="返回"回候选。':''}${c.compare?'按钮label="加入比较"切换当前项，显示所选比较项。':''}按钮没有选中项时disabled。不要用本地已有摘要冒充新增详情。筛选清空后恢复所有候选。`
 const exact='\n【精确规则】只有组件支持surface，card根不支持surface。表达式必须使用完整命名空间data.x/state.x/derived.x/bindings.x.value，禁止裸变量rows、selected。事件属性为字符串动作ID：onPress="refresh"，不是onPress={refresh}。collection的onSelect读取event.item完整行，event.id是UI行键，不是业务ID。state record初始为{}而非null；选择为空时判断!state.selected.id，详情按钮必须disabled。each写itemKey={item.id}。按钮label外也可写正文。工具binding的initial可省略，宿主提供合法空值。禁止把resultSample直接写死成data来替代首次取数。'
 const ownership=auto&&!c.static?'\n【本次输出所有权】只写card外壳与UI节点。绑定、派生、状态、动作全部由宿主提供，不输出任何binding/state/derive/action/data声明。直接引用下面的宿主接口；不要把接口复制成声明。'+contract:''
 return [{role:'system',content:system+exact+ownership},{role:'user',content:JSON.stringify({request:c.prompt,acceptance,dataMode:'受控合成工具替身，并非实时信息',...(!auto||c.static?{contract}:{}),resultSample:envelope(rows)})}]
}
export function compile(c,arm,source){const expanded=expand(c,arm,source.replace(/^```[^\n]*\n|\n```$/g,''));const result=compileCard(expanded,{final:true,cardId:`binding-${c.id}-${arm}`,context:{expressionDialect:'js-v1'}});return {...result,expanded}}
export function transportFor(c,arm,map,requests){return async request=>{requests.push({tool:request.tool,input:request.input,at:Date.now()});validateToolInput(request.tool,request.input);if(request.tool===c.tool){if(c.write)return {kind:'json',value:envelope([{status:'paused'}])};return {kind:'json',value:envelope(arm==='A0'?c.rows:normalize(c.rows,map))}}if(c.detail&&request.tool===c.detail.tool){const wanted=request.input[c.detail.param],row=c.rows.find(r=>String(r[c.map.id])===String(wanted));if(!row)throw Error('BAD_BUSINESS_ID');for(const [k,v]of Object.entries(c.detail.fixed||{}))if(request.input[k]!==v)throw Error('BAD_DEPENDENCY_'+k);const value=c.details(wanted);return {kind:'json',value:arm==='A0'?value:envelope([{id:wanted,body:value.items.map(x=>Object.values(x).join(' · ')).join('\n')}])}}throw Error('Unexpected tool '+request.tool)}}
export function props(node,session){return Object.fromEntries(Object.entries(node.props||{}).map(([k,v])=>[k,v.kind==='literal'?v.value:evaluate(v,session.scope())]))}
export function nodes(spec){const all=[];function walk(n){if(!n||typeof n!=='object')return;all.push(n);for(const c of n.children||[])walk(c)}for(const n of spec.children)walk(n);return all}
export async function checkInteraction(c,arm,map,spec,options={}){
 const makeTransport=options.transportFor||transportFor
 const calls=[],checks=[],storageMap=new Map(),storage={getItem:k=>storageMap.get(k)||null,setItem:(k,v)=>storageMap.set(k,v)},session=createCardSession(spec,{transport:makeTransport(c,arm,map,calls),storage,persistenceKey:'binding-qa',authorizeWrite:async()=>true});const pause=()=>new Promise(r=>setTimeout(r,30));session.setActivity({complete:true,visible:true});await pause()
 const find=(type,label)=>nodes(spec).find(n=>n.type===type&&(!label||props(n,session).label===label));
 const run=async(name,f)=>{try{await f();checks.push({name,passed:true})}catch(e){checks.push({name,passed:false,error:e.message})}};
 const fire=async(n,evt,event)=>{if(!n)throw Error('Required component missing');const p=props(n,session);session.fire(p[evt],{event,args:p.args||{}});await pause();if(session.current().error)throw Error(session.current().error)}
 const button=label=>find('button',label)
 if(c.write){await run('no-write-before-click',()=>{if(calls.length)throw Error('Premature write')});await run('manual-write',async()=>{await fire(button('暂停'),'onPress',{});if(calls.length!==1||calls[0].tool!==c.tool)throw Error('Expected exactly one pause')})}
 else if(c.static){await run('local-change',async()=>{const before=JSON.stringify(session.current().store.values);await fire(button('切换颜色'),'onPress',{});if(JSON.stringify(session.current().store.values)===before)throw Error('No state change')});await run('zero-tools',()=>{if(calls.length)throw Error('Unexpected tools')})}
 else {
  await run('initial-tool',()=>{if(!calls.some(x=>x.tool===c.tool))throw Error('No initial tool read')});
  const list=find('collection'),getItems=()=>props(list,session).items;
  await run('initial-items',()=>{if(!list||getItems().length!==c.rows.length)throw Error('Incomplete candidates')});
  await run('filter-changes-candidates',async()=>{await fire(find('input','筛选'),'onChange',{value:c.rows[0][c.map.title]});if(getItems().length!==1)throw Error('Filter did not narrow to one');await fire(find('input','筛选'),'onChange',{value:''});if(getItems().length!==c.rows.length)throw Error('Clearing filter did not restore candidates')});
  await run('selection-and-dependent-detail',async()=>{const row=getItems()[0];await fire(list,'onSelect',{id:String(row.rowKey||row.id||row[c.map.id]),item:row});if(c.detail){await fire(button('查看详情'),'onPress',{});const detail=calls.find(x=>x.tool===c.detail.tool);if(!detail||String(detail.input[c.detail.param])!==String(c.rows[0][c.map.id]))throw Error('Incorrect detail entity');await fire(button('返回'),'onPress',{})}});
  if(c.compare)await run('compare-two-entities',async()=>{await fire(button('加入比较'),'onPress',{});const row=getItems()[1];await fire(list,'onSelect',{id:String(row.rowKey||row.id||row[c.map.id]),item:row});await fire(button('加入比较'),'onPress',{});if(!Object.values(session.current().store.values).some(v=>Array.isArray(v)&&v.length===2))throw Error('No pair selected')});
  await run('manual-refresh',async()=>{const n=calls.length;await fire(button('刷新'),'onPress',{});if(calls.length<=n)throw Error('Refresh did not invoke tool')});
 }
 await run('state-restores',async()=>{const before=JSON.stringify(session.current().store.values);session.save();const restored=createCardSession(spec,{transport:makeTransport(c,arm,map,[]),storage,persistenceKey:'binding-qa',authorizeWrite:async()=>true});try{if(JSON.stringify(restored.current().store.values)!==before)throw Error('State differs after restore')}finally{restored.dispose()}})
 session.dispose();return {checks,calls,passed:checks.every(x=>x.passed),scope:'Headless host runtime; DOM visibility and returned-detail display are separately browser-checked'}
}

