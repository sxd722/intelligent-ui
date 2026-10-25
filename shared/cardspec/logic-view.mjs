import {evaluate} from './expression.mjs'
import {REGISTRY,checkValue} from './registry.mjs'
import {validateWidget} from './widgets.mjs'
import {expressionPath} from './dataflow.mjs'
// Check the candidate local UI before commit; never execute JS or actions.
export function validateLogicView(nodes,scope,{strictLocalValues=false}={}){
 let visited=0
 function walk(list,local){for(const n of list){
  if(++visited>1200)throw Error('局部界面超过节点预算')
  if(n.type==='run'){evaluate(n.value,local);continue}
  if(n.props.visible&&evaluate(n.props.visible,local)===false)continue
  if(n.type==='if'&&!evaluate(n.props.test,local))continue
  const p={}
  for(const [key,ast]of Object.entries(n.props)){if(['args','itemKey'].includes(key))continue;p[key]=evaluate(ast,local);if(!checkValue(REGISTRY[n.type].props[key],p[key]))throw Error(`${n.type}.${key} 数据类型不匹配`)}
  if(strictLocalValues&&n.type==='stat'&&n.props.value&&p.value==null){
   const path=expressionPath(n.props.value);let value=local.local,missing=false
   if(path?.[0]==='local')for(const key of path.slice(1)){if(value==null||!Object.hasOwn(Object(value),key)){missing=true;break}value=value[key]}
   if(missing)throw Error(`${n.id}: stat.value reads an uninitialized local value (${path.join('.')}). Compute the initial view with reactive=true/init, supply complete initial data, or show an explicit unknown placeholder until a user calculation. Missing values must not appear as blank metrics.`)
  }
  validateWidget(n.type,p)
  if(n.type==='each'){
   const seen=new Set()
   for(const [index,item]of p.items.entries()){
    const child={...local,item,index,[p.as||'item']:item},id=evaluate(n.props.itemKey,child)
    if(id==null||id===''||seen.has(String(id)))throw Error('局部条目需要唯一的 itemKey')
    seen.add(String(id));walk(n.children,child)
   }
  }else walk(n.children||[],local)
 }}walk(nodes,scope)
}
