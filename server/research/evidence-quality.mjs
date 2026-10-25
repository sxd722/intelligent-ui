// These are provenance signals, not automatic fact checking or endorsements.
export function evidenceProfile(item,now=new Date().toISOString()){
 const published=Date.parse(item.publishedAt),fetched=Date.parse(now)
 const mentionedDates=[...new Set(String(item.excerpt||'').match(/\b20\d{2}-\d{2}-\d{2}\b/g)||[])].slice(0,12)
 return {level:item.kind==='page'?'page-excerpt':'search-snippet',authority:'unverified',
  publishedAt:item.publishedAt||null,fetchedAt:now,
  publicationAgeDays:Number.isFinite(published)?Math.max(0,Math.floor((fetched-published)/86400000)):null,
  mentionedDates,dateMeaning:'mentions-only; not necessarily event dates',coverage:item.truncated?'partial':'provided-excerpt',claimVerification:'not-established'}
}
export function evidenceDiagnostics(evidence,{goal='',localDate=''}={}){
 const warnings=[],warn=(code,message)=>warnings.push({severity:'warning',code,message})
 if(!evidence.length)return warnings
 if(!evidence.some(e=>e.kind==='page'))warn('evidence_snippet_only','Only search snippets were obtained; do not claim to have verified original requirements or current availability.')
 const dates=evidence.flatMap(e=>e.quality?.mentionedDates||[])
 if(localDate&&/(当前|最新|今天|订票|抢票|available|current|latest)/i.test(goal)&&dates.length&&dates.every(d=>d<localDate))
  warn('evidence_time_check',`All explicit dates in the retrieved excerpts precede ${localDate}. Verify event dates and availability; fetch time does not make historical material current.`)
 return warnings
}
