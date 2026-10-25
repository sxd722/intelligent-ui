// Serialized into the trusted iframe renderer. No model JS or per-frame bridge.
export function createSvgMotion(){
 const attrs=['x','y','width','height','cx','cy','r','rx','ry','d','points','transform'],pending=new Map()
 const number=/-?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/gi
 let frame=0
 const allowed=()=>!document.hidden&&!document.documentElement.hasAttribute('data-motion-paused')&&document.documentElement.dataset.motionLevel!=='off'&&!matchMedia('(prefers-reduced-motion: reduce)').matches
 const capture=el=>Object.fromEntries(attrs.map(k=>[k,el.getAttribute(k)]))
 const finish=()=>{cancelAnimationFrame(frame);frame=0;for(const [el,job] of pending)if(el.isConnected)for(const [k,value]of Object.entries(job.to))if(value!==null)el.setAttribute(k,value);pending.clear()}
 const tick=now=>{
  frame=0;if(!allowed()){finish();return}
  for(const [el,job]of pending){if(!el.isConnected){pending.delete(el);continue}const t=Math.min(1,(now-job.start)/job.duration),e=1-(1-t)**3
   for(const [k,blend] of Object.entries(job.blends)){let index=0;el.setAttribute(k,t===1?job.to[k]:job.to[k].replace(number,()=>String(blend.from[index]+(blend.to[index]-blend.from[index++])*e)))}
   if(t===1)pending.delete(el)
  }
  if(pending.size)frame=requestAnimationFrame(tick)
 }
 const update=(el,from)=>{
  // New topology, excessive paths or non-finite coordinates snap to final data.
  const existing=pending.get(el),to=capture(el),blends={}
  if(from&&allowed()&&existing&&attrs.every(k=>to[k]===existing.to[k])){for(const k of Object.keys(existing.blends))if(from[k]!==null)el.setAttribute(k,from[k]);return}
  pending.delete(el);if(!from||!allowed()||pending.size>=64)return
  for(const k of attrs){const a=from[k],b=to[k];if(a===null||b===null||a===b||a.length>2048||b.length>2048||k==='d'&&/[aA]/.test(b)||a.replace(number,'#')!==b.replace(number,'#'))continue
   const x=(a.match(number)||[]).map(Number),y=(b.match(number)||[]).map(Number)
   if(!x.length||x.length!==y.length||x.length>128||[...x,...y].some(v=>!Number.isFinite(v)))continue
   blends[k]={from:x,to:y};el.setAttribute(k,a)
  }
  if(!Object.keys(blends).length)return
  pending.set(el,{to,blends,start:performance.now(),duration:document.documentElement.dataset.motionLevel==='light'?150:340})
  if(!frame)frame=requestAnimationFrame(tick)
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish()})
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{if(e.matches)finish()})
 addEventListener('pagehide',finish)
 return {capture,update,finish}
}
