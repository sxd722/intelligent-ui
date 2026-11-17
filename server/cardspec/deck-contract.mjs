import {journeyRequirements} from './journey-coverage.mjs'
import {makeScope,createStore} from '../../shared/cardspec/store.mjs'
import {evaluate} from '../../shared/cardspec/expression.mjs'
import {expressionPath,expressionReads,visitExpression} from '../../shared/cardspec/dataflow.mjs'

// Carry the small interface, never the previous card's full implementation.
export function deckInterface(spec){
 const scope=makeScope(spec,createStore()),states={}
 for(const [id,d]of Object.entries(spec.state||{}))if(d.scope==='deck')states[id]={type:d.type,initial:scope.state[id]}
 const nodes=children=>(children||[]).flatMap(n=>[n,...nodes(n.children)])
 const all=nodes(spec.children),domains=new Map()
 for(const n of all){
  const selected=expressionPath(n.props?.selectedId||n.props?.value)
  if(selected?.length!==2||selected[0]!=='state')continue
  let rows;try{rows=evaluate(n.props.nodes||n.props.options||n.props.items,scope)}catch{continue}
  if(!Array.isArray(rows)||!rows.length||rows.length>40)continue
  const ids=rows.map(r=>typeof r==='string'?r:n.props.options?r.value:r.id)
  if(ids.every(id=>typeof id==='string'))domains.set(selected[1],ids)
 }
 // Preserve the entity domain, not merely the record type. Otherwise sibling
 // cards can write question IDs while the first card reads topic IDs.
 for(const ast of [...Object.values(spec.derived||{}),...all.flatMap(n=>[n.value,...Object.values(n.props||{})])])visitExpression(ast,node=>{
  if(node.type!=='get')return
  const path=expressionPath(node.object)
  if(path?.length!==2||path[0]!=='state'||states[path[1]]?.type!=='record')return
  const keys=expressionReads(spec,node.key,'state').map(id=>domains.get(id)).filter(Boolean)
  if(keys.length===1)states[path[1]].keyDomain=[...new Set([...(states[path[1]].keyDomain||[]),...keys[0]])]
 })
 const scalarValues=ast=>ast?.type==='literal'?[ast.value]:ast?.type==='binary'&&['==','===','!=','!==','<','>','<=','>='].includes(ast.op)||ast?.type==='unary'&&ast.op==='!'?[false,true]:ast?.type==='conditional'?(()=>{const a=scalarValues(ast.yes),b=scalarValues(ast.no);return a&&b?[...a,...b]:null})():null
 for(const [id,field]of Object.entries(states))if(field.type==='record'){
  const writes=Object.values(spec.actions||{}).flat().filter(s=>s.target===id)
  const values=writes.map(s=>s.type==='set'&&s.key?scalarValues(s.value):s.type==='toggle'&&s.key?[false,true]:null)
  if(values.length&&values.every(Boolean)){
   const union=[...new Set(values.flat())],types=[...new Set(union.map(v=>typeof v))]
   if(types.length===1&&['boolean','string','number'].includes(types[0])){field.valueType=types[0];if(union.length<=8)field.values=types[0]==='boolean'?[false,true]:union}
  }
 }
 const entities={}
 for(const id of Object.keys(spec.data||{})){
  const rows=scope.data[id]
  if(Array.isArray(rows)&&rows.length<=40&&rows.every(r=>r&&typeof r==='object'&&r.id!=null))entities[id]=rows.map(({id,label,title,parentId,topic})=>({id,...(label?{label}:title?{label:title}:{}),...(parentId?{parentId}:{}),...(topic?{topic}:{})}))
 }
 return {states,entities,policy:'共享state声明使用相同id/type和scope="deck"，仍通过state.id及现有action读取写入；有keyDomain的record以共同实体ID为key，子项映射到所属实体，不另建局部ID键；valueType/values规定已存在的值编码（boolean不可改成字符串标记）。实体ID沿用entities。局部输入/展开不要共享。'}
}
export function deckCoverage(goal,deck){
 const journeys=journeyRequirements(goal)
 const items=journeys.map(r=>{
  const evidence=deck.flatMap(c=>(c.spec?.requirementCoverage?.items||[]).filter(x=>x.id===r.id&&x.status!=='other-card').map(x=>({cardId:c.id,status:x.status,evidence:x.evidence||[]})))
  return {...r,status:evidence.some(e=>e.status==='failed')?'failed':evidence.some(e=>e.status==='checked')?'locally-checked':'unverified',evidence}
 })
 const shared=new Map(),issues=[]
 for(const c of deck)for(const [id,d]of Object.entries(c.spec?.state||{}))if(d.scope==='deck'){
  if(shared.has(id)&&shared.get(id).type!==d.type)issues.push({code:'deck_state_type',state:id,cardId:c.id})
  else shared.set(id,{type:d.type,cards:[...(shared.get(id)?.cards||[]),c.id]})
 }
 if(deck.length>1&&/(跨卡|共用.*状态|共享.*状态|同步.*标记)/.test(goal+' '+deck.map(c=>c.goal||c.spec?.intro||'').join(' '))&&![...shared.values()].some(s=>s.cards.length>1))issues.push({code:'deck_shared_unverified',message:'跨卡共享承诺没有共同的scope=deck状态；不作为已实现功能交付。'})
 return {version:1,status:'partial',items,sharedStates:[...shared.keys()],issues,scope:'局部路径证据汇总；跨卡往返/刷新必须由整组浏览器测试验证，不将locally-checked冒充端到端通过。'}
}
