// Only normalize the common click value/name mix-up against one observed control.
export function resolveClickStep(step,controls=[]){
 if(step.op!=='click'||step.handle)return step
 const normalized=v=>String(v||'').replace(/\s+/g,' ').trim()
 const matchesFor=name=>controls.filter(c=>normalized(c.name)===normalized(name)&&!c.disabled&&(!step.role||step.role===c.role))
 const primary=matchesFor(step.name),matches=primary.length?primary:step.value?matchesFor(step.value):[]
 return matches.length===1?{...step,name:normalized(matches[0].name),role:matches[0].role,...(matches[0].handle?{handle:matches[0].handle}:{})}:step
}
import {compileCard} from '../../shared/cardspec/compiler.mjs'
export function observedClickRole(step,controls=[]){
 if(step.role)return step.role
 const matches=controls.filter(c=>c.name===step.name&&!c.disabled)
 return matches.length===1?matches[0].role:'button'
}
// Actual module interfaces supersede the planner's tentative names. Expose
// shapes/one example rather than sending the whole question bank or dataset.
export function buildInterface(source){
 const spec=compileCard(source||'',{final:false,context:{expressionDialect:'js-v1',renderMode:'hybrid'}}).spec
 if(!spec)return undefined
 const shape=v=>Array.isArray(v)?{type:'array',length:v.length,item:v.length?shape(v[0]):undefined}:v&&typeof v==='object'?Object.fromEntries(Object.entries(v).slice(0,12).map(([k,x])=>[k,shape(x)])):typeof v
 const expressionShape=ast=>ast?.type==='literal'?shape(ast.value):ast?.type==='array'?{type:'array',length:ast.items.length,item:expressionShape(ast.items[0])}:ast?.type==='object'?Object.fromEntries(ast.entries.slice(0,12).map(([k,v])=>[k,expressionShape(v)])):'expression'
 const sandboxes=[];const walk=nodes=>{for(const n of nodes||[]){if(n.type==='sandbox')sandboxes.push({id:n.id,input:n.props.input,actions:n.props.actions||{type:'literal',value:{}}});walk(n.children)}};walk(spec.children)
 return {bindings:Object.fromEntries(Object.entries(spec.bindings||{}).map(([id,b])=>[id,{tool:b.tool,input:b.input,load:b.load}])),state:Object.fromEntries(Object.entries(spec.state||{}).map(([k,v])=>[k,{type:v.type,initial:v.initial?.type==='literal'&&JSON.stringify(v.initial.value).length<100?v.initial.value:expressionShape(v.initial)}])),data:Object.fromEntries(Object.entries(spec.data||{}).map(([k,v])=>[k,expressionShape(v)])),derived:Object.keys(spec.derived||{}),actions:Object.fromEntries(Object.entries(spec.actions||{}).map(([k,v])=>[k,JSON.stringify(v).slice(0,650)])),sandboxes}
}
// Bounded observations, never page source or arbitrary JavaScript for the tester.
export function buildObservation(snapshot){
 if(!snapshot)return undefined
 const state=Object.fromEntries(Object.entries(snapshot.state||{}).slice(0,20).map(([k,v])=>[k,JSON.stringify(v).length<=300?v:{summary:'large value',type:Array.isArray(v)?'array':typeof v,length:v?.length}]))
 return {state,text:snapshot.text?.slice(0,1300),visualCount:snapshot.visualCount,controls:snapshot.controls?.slice(0,18).map(({name,role,disabled,sandbox,value,min,max,step,checked})=>({name:name?.slice(0,100),role,disabled,sandbox,value,min,max,step,checked}))}
}
export function buildFeedback(feedback,evidence,assembled){
 const diagnostics=(feedback.diagnostics||[]).map(d=>({...d,module:(['rich_content','debug_runtime'].includes(d.code)?assembled.bindings.find(r=>d.offset>=r.start&&d.offset<r.end)?.module:undefined)||assembled.ranges.find(r=>d.offset>=r.start&&d.offset<r.end)?.name})).slice(0,5)
 const runs=(evidence?.runs||[]).filter(r=>r.scenario==='normal')
 const normal=runs.find(r=>r.actions?.some(a=>!a.skipped&&(!a.ok||a.assertion?.passed===false)))||runs[0],failures=(normal?.actions||[]).map((a,i)=>!a.skipped&&(!a.ok||a.assertion?.passed===false)?i:-1).filter(i=>i>=0).slice(0,2)
 const locations=compileCard(assembled.source,{final:false}).locations||{}
 const layoutAll=runs.flatMap(r=>[...(r.initial?.layout?.issues||[]),...(r.final?.layout?.issues||[]),...(r.actions||[]).flatMap(a=>a.layoutIssues||[])].filter(i=>['internal-overflow','clipped-content','control-not-fully-visible','control-occluded'].includes(i.code)).map(i=>{
  const locate=element=>{const id=String(element||'').split('/').map(id=>id.trim()).reverse().find(id=>Object.hasOwn(locations,id)),offset=locations[id];return {offset,module:assembled.ranges.find(r=>offset>=r.start&&offset<r.end)?.name}}
  const own=locate(i.element),child=(i.contributors||[]).map(c=>locate(c.element)).find(c=>c.module&&c.module!=='main.cardspec')
  const {offset}=child||own
  const module=String(i.element).includes(' / iframe / ')?(assembled.bindings.find(b=>offset>=b.start&&offset<b.end)?.module||(child||own).module):(child||own).module
  return {...i,viewportWidth:r.width,module,offset}
 }))
 const layout=[...new Map(layoutAll.map(i=>[[i.viewportWidth,i.code,i.element].join(':'),i])).values()].slice(0,4)
 const implementation=diagnostics.some(d=>d.severity==='error'&&!['requirement_assertion','debug_test_step'].includes(d.code))||layout.length>0
 return {version:feedback.version,status:feedback.status,mode:feedback.mode,diagnostics,layout,module:diagnostics.find(d=>d.severity==='error'&&d.module)?.module||layout.find(d=>d.module)?.module,phase:implementation?'implementation':'test',testRepair:failures.map(i=>({stepIndex:i,requested:normal.actions[i].step,reason:normal.actions[i].error||normal.actions[i].assertion?.failures,available:normal.actions[i].observed?.controls})),initial:buildObservation(normal?.initial),actions:normal?.actions?.slice(0,32).map((a,i)=>({step:a.step,ok:a.ok,skipped:a.skipped,assertion:a.assertion,error:a.error,changed:a.changed,observed:failures.includes(i)||i===normal.actions.length-1?a.observed:undefined})),unavailable:!normal?evidence?.reason:undefined}
}
export const TEST_BUILD_PROTOCOL=`你是只读验收编写器，不写或读取实现源码。测试浏览器固定随机种子，修改实现后宿主会重放已通过路径；retainedEvidence只包含当前源码版本证据。只补未验证需求，不反复退回只测开始按钮。随机选项只能使用实际观察到的控件，不要求修改业务随机逻辑迎合测试。只输出JSON：
{"op":"test","claims":[{"id":"R1","modules":["main.cardspec"]}],"steps":[{"op":"click","name":"实际控件标签","requirement":"R1","expect":{"changed":true,"state":{"n":1}}}]}。
最多16个交互/重载操作；只读check可单列，总计最多32步，从initial状态开始，必须包含到达目标视图的操作。每项需求需要至少一个requirement及expect，交互/模拟必须有操作和实际反馈；最后reload检查恢复。op=click|fill|select|check|reload。check只观察不点击，切换复选框用click+role:checkbox。reload应保留操作后的状态，不能期待回到初值，expect.changed=false。fill/select的value是字符串；name为观察到的完整标签，不能用节点ID；role使用观测角色button/tab/radio/checkbox/switch/slider/textbox/combobox，滑块用fill。expect只支持text短字符串/最多6项短字符串数组、state顶层字段精确值、changed布尔、visual布尔。同名控件用index:0/1区分（从0开始）；state里的数组要写完整数组，不能用数字代替长度。不确定ID时断言可见文本。不要猜隐藏控件的handle。可先测试已观察路径，再依据observed中的新控件补全完整脚本。没有观察到的结果不可宣称成功。打开详情对话框后，先通过实际关闭按钮关掉再操作外部控件。observed的large value摘要不是实际state值，不能虚构xxx_length字段。
涉及计算时，从原请求确定常量和单位，用两组输入核对预期结果及解释文字；不能照抄页面当前数值作为正确答案。
修复定位/值类型/脚本顺序，不改需求和验收标准，不用当前错误值替代正确预期。实现确实违反验收时返回{"op":"implementation_issue","module":"模块名","reason":"具体违反哪项验收、预期与观察差异","stepIndex":0}，stepIndex必须指向已执行且断言失败/无反馈的步骤，或导航后预期控件缺失的步骤。没有证据时先test。claim可记录blocked事实限制，但不豁免交互。不可用返回{"op":"blocked","reason":"具体原因"}。` 

