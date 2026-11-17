// A small, explicit current-object contract. Never infer joins from similar names.
export function compositionSubject(value){
 if(value==null)return null
 if(!value||typeof value!=='object'||Array.isArray(value)||!['string','number'].includes(typeof value.id)||typeof value.title!=='string')throw Error('COMPOSITION: subject needs stable id and title')
 return {id:String(value.id),title:value.title,summary:typeof value.summary==='string'?value.summary:'',...(value.assetRef?{assetRef:value.assetRef}:{}),...(value.imageQuery?{imageQuery:value.imageQuery}:{})}
}
export function compositionMedia(media,subject,items=[]){
 if(media!==undefined&&(!Array.isArray(media)||media.length>6))throw Error('COMPOSITION: media is an array of at most six resources')
 const explicit=[...(media||[]),...(subject?.assetRef||subject?.imageQuery?[{...(subject.assetRef?{assetRef:subject.assetRef}:{query:subject.imageQuery}),alt:subject.title}]:[])]
 const result=[],seen=new Set();let generated=0
 for(const m of [...explicit,...items.filter(i=>i.assetRef).map(i=>({assetRef:i.assetRef,alt:i.title,entityId:i.id,provenance:i.provenance}))]){
  if(!m||typeof m!=='object')throw Error('COMPOSITION: invalid media')
  if(m.assetRef&&m.query)throw Error('COMPOSITION: choose assetRef or query, not both')
  const asset=typeof m.assetRef==='string'&&/^asset\.v1\.[\w-]+\.[\w-]+$/.test(m.assetRef)&&m.assetRef.length<=3000
  const query=!m.assetRef&&typeof m.query==='string'&&m.query.trim()&&m.query.length<=100?m.query:null
  if(!asset&&!query){if(explicit.includes(m))throw Error('COMPOSITION: media needs a signed assetRef or query (max 100 chars)');continue}
  const key=asset?m.assetRef:query;if(seen.has(key))continue;seen.add(key)
  if(query&&/^gen:/i.test(query)&&++generated>2)throw Error('COMPOSITION: at most two generated media requests')
  result.push({...(asset?{assetRef:m.assetRef}:{query}),alt:typeof m.alt==='string'?m.alt:subject?.title||'素材',entityId:m.entityId??subject?.id??null,kind:asset?'source-image':'illustration',provenance:m.provenance||[]})
  if(result.length===6)break
 }
 return result
}
