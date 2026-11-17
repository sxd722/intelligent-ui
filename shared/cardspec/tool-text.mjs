// Narrative fields are text slots, not HTML render surfaces. Preserve code and
// raw fields, entity identifiers and numeric values unchanged.
export function normalizeToolNarratives(value,depth=0){
 if(!value||typeof value!=='object'||depth>12)return value
 if(Array.isArray(value))return value.map(v=>normalizeToolNarratives(v,depth+1))
 return Object.fromEntries(Object.entries(value).map(([k,v])=>{
  if(typeof v==='string'&&/^(description|summary|shortDescription|synopsis|introduction)$/.test(k)&&/<\/?(?:a|p|div|span|br|strong|em|ul|li)\b[^>]*>/i.test(v))
   v=v.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[m])).replace(/\s+/g,' ').trim()
  else if(v&&typeof v==='object')v=normalizeToolNarratives(v,depth+1)
  return [k,v]
 }))
}
