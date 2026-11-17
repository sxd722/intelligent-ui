// Annotations describe exact original records, never a title/ID similarity join.
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)
const original=({analysisLabel,analysisQuote,...row})=>row
export function evidenceAnnotations(refs,bindings){
 if(refs===undefined)return ()=>null
 const ids=typeof refs==='string'?[refs]:refs
 if(!Array.isArray(ids)||ids.length>8||ids.some(id=>typeof id!=='string'||!Object.hasOwn(bindings,id)))throw Error('COMPOSITION: annotations must reference declared binding IDs')
 const entries=new Map()
 for(const id of ids){const b=bindings[id];if(b.tool!=='dataset.analyze')throw Error('COMPOSITION: annotations require dataset.analyze')
  if(b.current===false||b.value?.analysis?.status==='stale')continue
  const tool=b.value?.analysis?.dataset?.tool||(b.value?.analysis?.scope==='supplied sample only'&&Array.isArray(b.input?.items)?'*':null)
  if(!tool||!Array.isArray(b.value?.items))continue
  for(const row of b.value.items){const raw=original(row),quote=row.analysisQuote,label=row.analysisLabel
   if(tool==='*'&&!b.input.items.some(input=>stable(original(input))===stable(raw)))continue
   if(typeof label!=='string'||!label.trim()||label.length>40||typeof quote!=='string'||!quote.trim()||!Object.values(raw).some(v=>typeof v==='string'&&v.includes(quote)))continue
   const key=tool+stable(raw),value={label,quote}
   // Conflicting classifications of the same snapshot are unknown, not last-write-wins.
   if(!entries.has(key))entries.set(key,value)
   else if(stable(entries.get(key))!==stable(value))entries.set(key,null)
  }
 }
 const lookup=(tool,row)=>{const key=stable(original(row));return entries.has(tool+key)?entries.get(tool+key):entries.get('*'+key)||null}
 lookup.available=[...entries.values()].filter(Boolean).length
 return lookup
}
export const sourceLabel=tool=>({xiaohongshu:'小红书',bilibili:'B站',weibo:'微博',hackernews:'Hacker News'})[String(tool).split('.')[1]]||String(tool).split('.')[1]||tool
export function evidenceSlice(items,{source='',query='',category=''}={}){
 const base=items.filter(i=>(!source||i.provenance.some(s=>s.tool===source))&&(!query||[i.title,i.summary,i.author].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())))
 const counts=new Map()
 for(const item of base){const label=item.classification?.label||'未分类';counts.set(label,(counts.get(label)||0)+1)}
 return {total:base.length,groups:[...counts].map(([label,count])=>({label,count})),items:base.filter(i=>!category||(i.classification?.label||'未分类')===category)}
}
