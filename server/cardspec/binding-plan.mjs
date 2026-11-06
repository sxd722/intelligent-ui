import {presentationFor} from '../../shared/cardspec/tool-presentations.mjs'
import {REGISTRY} from '../../shared/cardspec/registry.mjs'
import {createHash} from 'node:crypto'
import {canonicalInput} from '../../shared/cardspec/prefetch.mjs'
import {toolResultDiagnostics} from '../../shared/cardspec/tool-result-diagnostics.mjs'
import {referencePaths,visitExpression} from '../../shared/cardspec/dataflow.mjs'
import {evaluate} from '../../shared/cardspec/expression.mjs'
import {createStore,makeScope} from '../../shared/cardspec/store.mjs'
import {decisionProfile} from '../../shared/cardspec/decision-profile.mjs'

// An optional annotation on existing describe/read calls, not another model turn
// or DSL. These are commitments to live UI, distinct from research-only reads.
export const BINDING_INTENT_SCHEMA={type:'object',additionalProperties:false,required:['purpose'],properties:{purpose:{type:'string',minLength:1,maxLength:160},load:{type:'string',enum:['visible','manual']}}}
export const BINDING_PLAN_INSTRUCTION='事实核实可用web_search/web_read；搜索摘要不能替代卡片的实时查询。需求含查询/刷新/按选择取详情时，先发现相关CLI，在cli_describe或cli_read附带binding:{purpose:"用户操作→更新区域",load:"visible或manual"}，同时确认数据与交互计划，无需另一次规划。使用宿主返回的bindingRecipe声明绑定并消费结果；生成前取数是首屏种子，不要抄成静态列表。只查背景资料不传binding。纯本地操作不凑工具；不可用时说明缺口，不冒充成功。'
export function validateBindingIntent(intent){
 if(intent===undefined)return
 if(!intent||typeof intent!=='object'||Array.isArray(intent)||Object.keys(intent).some(k=>!['purpose','load'].includes(k))||typeof intent.purpose!=='string'||!intent.purpose.trim()||intent.purpose.length>160||intent.load!==undefined&&!['visible','manual'].includes(intent.load))throw Error('binding requires purpose (1–160 chars) and optional load=visible|manual')
}
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
export function bindingRecipe(tool,input,intent){
 const id='b_'+createHash('sha256').update(tool+canonicalInput(input??{})).digest('hex').slice(0,8)
 const load=intent?.load||'visible'
 // Serialize data as an expression, never interpolate arbitrary values as markup.
 const args=input===undefined?'参数对象':canonicalInput(input).replaceAll('<','\\u003c').replaceAll('>','\\u003e')
 return {id,tool,load,pagination:"host-owned; all returned items; no page state/actions",declaration:`<binding id="${id}" tool="${xml(tool)}" input={${args}} load="${load}"/>`,value:`bindings.${id}.value`,...(decisionProfile(tool)?{consumer:`<tool-view binding="${id}"/>`,ownership:'宿主已提供选择、筛选、详情补取、返回与恢复；把consumer直接放在card下，不再声明chosen/favorite/detail状态或重复按钮。参数编辑仅设置binding输入state。'}:{...(presentationFor(tool)?{consumer:`<tool-view binding="${id}"/>`}:{}),refresh:`<action id="refresh_${id}"><invoke binding="${id}"/></action>`}),reuse:'相同工具/参数复用生成前结果；动态输入可用state。保留真实实体ID。',layout:decisionProfile(tool)?decisionProfile(tool).kind==='tickets'?'多程合成一个 <tool-view bindings={{去程:"out",回程:"back"}}/>（引用实际binding ID）；两张票券、独立固定、票价和经停内置。':'海报舞台已内置类型/片长筛选、收藏、两片对比和详情补齐。不需要task参数或外围UI。':'自由布局，已映射工具可用tool-view，多源用task-board。'}
}
export function createBindingPlan(){
 const entries=[]
 return {
  add(tool,intent,{input,available=true,reason}={}){
   validateBindingIntent(intent);if(!intent)return
   const key=tool+canonicalInput(input??null),existing=entries.find(e=>e.key===key)||entries.find(e=>e.tool===tool&&e.purpose===intent.purpose&&e.input===undefined)
   const value={key,tool,purpose:intent.purpose,load:intent.load||'visible',available,...(reason?{reason}:{}),...(input===undefined?{}:{input})}
   if(existing)Object.assign(existing,value);else{if(entries.length>=12)throw Error('binding plan allows at most 12 connections');entries.push(value)}
  },
  unavailable(tool,reason){for(const e of entries)if(e.tool===tool){e.available=false;e.reason=String(reason).slice(0,300)}},
  snapshot:()=>structuredClone(entries.map(({key,...e})=>e))
 }
}

export function bindingPlanDiagnostics(spec,plan=[],records=[]){
 if(!spec)return []
 const diagnostics=[],bindings=Object.entries(spec.bindings||{})
 const unconsumed=toolResultDiagnostics(spec,records)
 const reachable=new Set(),hostTriggers=new Set()
 function walk(nodes){for(const n of nodes||[]){
  for(const [key,value] of Object.entries(n.props||{}))if(REGISTRY[n.type]?.events?.[key]||key==='actions')visitExpression(value,ast=>{if(ast.type==='literal'&&typeof ast.value==='string'&&spec.actions?.[ast.value])reachable.add(ast.value)})
  if(n.type==='tool-view'&&n.props.binding?.type==='literal')hostTriggers.add(n.props.binding.value)
  if(n.type==='tool-view')for(const id of Object.values(n.props.bindings?.value||{}))hostTriggers.add(id)
  walk(n.children)
 }}
 walk(spec.children)
 // Explicit callback chains can be triggered by a reachable user action.
 for(const id of reachable)for(const s of spec.actions[id]||[])for(const cb of [s.onSuccess,s.onError])if(spec.actions?.[cb])reachable.add(cb)
 const steps=[...reachable].flatMap(id=>spec.actions[id]||[])
 for(const intent of plan){
  if(!intent.available){diagnostics.push({severity:'warning',code:'binding_plan_unavailable',message:`${intent.tool}: ${intent.reason||'当前不可执行'}；未完成“${intent.purpose}”。`});continue}
  const matches=bindings.filter(([,b])=>{
   if(b.tool!==intent.tool)return false
   // Dynamic search/selection intentionally changes parameters. Only reject
   // provably mismatched literal invocations, never guess entity equivalence.
   if(intent.input===undefined||referencePaths(b.input).length)return true
   try{return canonicalInput(evaluate(b.input,makeScope(spec,createStore())))===canonicalInput(intent.input)}catch{return true}
  })
  if(!matches.length){diagnostics.push({severity:'error',code:'binding_plan_missing',message:`${intent.tool}: 已承诺“${intent.purpose}”，但卡片无此binding；保留工具绑定和结果消费者，不能用静态数据替代。`});continue}
  if(matches.every(([id])=>unconsumed.some(d=>d.message.startsWith(id+':'))))diagnostics.push({severity:'error',code:'binding_plan_unconsumed',message:`${intent.tool}: “${intent.purpose}”的结果未进入UI，读取bindings.<id>.value或同查询的宿主dataset，不只展示status。`})
  if(matches.every(([id,b])=>b.load!=='visible'&&!hostTriggers.has(id)&&!steps.some(s=>s.type==='invoke'&&s.binding===id)))diagnostics.push({severity:'error',code:'binding_plan_unreachable',message:`${intent.tool}: 绑定为manual但没有可达invoke入口；为“${intent.purpose}”连接真实动作。`})
  const refreshPromised=/(刷新|refresh)/i.test(intent.purpose)&&!/(不|无需|不要|no |without ).{0,4}(刷新|refresh)/i.test(intent.purpose)
  if(refreshPromised&&matches.every(([id])=>!hostTriggers.has(id)&&!steps.some(s=>s.type==='invoke'&&s.binding===id)))diagnostics.push({severity:'error',code:'binding_plan_refresh_missing',message:`${intent.tool}: 已承诺手动刷新，但没有可达刷新动作。visible仅首次加载；使用真实button onPress→action/invoke，组件回调必须来自其已声明事件契约。`})
 }
 return diagnostics.filter((d,i,a)=>a.findIndex(x=>x.code===d.code&&x.message===d.message)===i)
}
