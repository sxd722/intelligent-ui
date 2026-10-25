import {detailRequests} from './result-view.mjs'
import {businessIdField} from './dataflow.mjs'

// Resolve only explicit identities against observed results, never by title or
// by guessing an ID. Relations come from the same catalog as host result views.
export function evidenceRequests(context,spec,bindings){
  const candidates=[]
  for(const [id,b] of Object.entries(bindings||{}))if(b.status==='success')for(const row of b.value?.items||[])
    candidates.push({binding:id,tool:spec.bindings[id]?.tool,row})
  const selected=new Map()
  function walk(value,depth=0){
    if(!value||typeof value!=='object'||depth>12)return
    if(!Array.isArray(value)){
      const fields=Object.keys(value).filter(k=>businessIdField(k)&&value[k]!=null)
      const matches=candidates.filter(c=>value.rowKey?c.row.rowKey===value.rowKey:fields.length&&fields.every(k=>String(c.row[k])===String(value[k]))&&(value.type==null||value.type===c.row.type))
      const requests=matches.flatMap(c=>detailRequests(c.tool,c.row).filter(r=>r.kind==='facts').map(r=>({...r,binding:c.binding})))
      const unique=new Map(requests.map(r=>[JSON.stringify([r.tool,r.input]),r]))
      if(unique.size>1)throw Object.assign(new Error('选中实体存在多个详情来源，请保留完整行的 rowKey 以消除歧义'),{code:'INVALID_INPUT'})
      for(const [key,r] of unique)selected.set(key,r)
    }
    for(const child of Object.values(value))walk(child,depth+1)
  }
  walk(context)
  if(selected.size>3)throw Object.assign(new Error('一次解读最多选择三个实体，请缩小选择后重试'),{code:'INVALID_INPUT'})
  return [...selected.values()]
}
export function boundedEvidence(tool,value){
  let remaining=6000,truncated=!!value.truncated
  function limit(v,depth=0){
    if(depth>8||remaining<=0){truncated=true;return null}
    if(typeof v==='string'){const out=v.slice(0,Math.min(3000,remaining));remaining-=out.length;if(out.length<v.length)truncated=true;return out}
    if(Array.isArray(v)){if(v.length>3)truncated=true;return v.slice(0,3).map(x=>limit(x,depth+1))}
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).slice(0,30).map(([k,x])=>[k,limit(x,depth+1)]))
    return v
  }
  const items=limit(value.items)
  return {tool,source:value.source,fetchedAt:value.fetchedAt,items,truncated}
}
